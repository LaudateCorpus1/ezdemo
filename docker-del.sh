#!/usr/bin/env bash

set -euo pipefail

CID=$(docker ps -f "status=running" -f "ancestor=erdincka/ezdemo" -q)
if [ "${CID}" != "" ]; then 
  rm -f ~/.kube/"${CID}"_admin.config 
  rm -f ~/"${CID}".hpecp.conf
  rm -f ~/"${CID}".hpecp_tenant.conf
  rm -f ~/"${CID}".ca-cert.pem
  docker stop "${CID}" || true 
  docker rm "${CID}" || true 
else
  echo "No running image matched, are you looking for this?"
  docker ps -f "status=running"
fi 
exit 0
