#!/usr/bin/env bash

USAGE="Usage: ${0} $(paste -s -d '|' providers)"

PROVIDERS=($(<providers))
if ! [ $# -gt 0 ] || ! (echo ${PROVIDERS[@]} | grep -w -q ${1}); then
  echo $USAGE
  exit 1
fi
set -euo pipefail

pushd "${1}" > /dev/null
  TF_IN_AUTOMATION=1 terraform destroy \
    -no-color \
    -parallelism 12 \
    -var-file=<(cat ./*.tfvars) \
    -auto-approve=true \
    
popd > /dev/null

source outputs.sh ${1}

rm -f ansible/group_vars/all.yml
rm -f ansible/inventory.ini
(ls "${1}"/*run.log | xargs rm -f) || true
(ls -d generated/*/ | xargs rm -rf) || true # Deletes all folders under generated, better than deleting the generated folder all together
rm -f generated/output.json

## Clean user environment
rm -f ~/.hpecp.conf
rm -f ~/.hpecp_tenant.conf
rm -f ~/.kube/config

# If sockets are created for MCS
([[ "${IS_MAPR}" == "true" ]] && ssh -S /tmp/MCS-socket-admin -O exit centos@${GATW_PRV_DNS}) || true
([[ "${IS_MAPR}" == "true" ]] && ssh -S /tmp/MCS-socket-installer -O exit centos@${GATW_PRV_DNS}) || true

echo "Environment destroyed"
echo "SSH key-pair, CA certs and cloud-init files are not removed!"

exit 0
