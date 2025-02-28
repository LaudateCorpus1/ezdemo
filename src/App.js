import React, { Fragment } from 'react';
import { Grommet, Box, Card, CardFooter, CheckBox, Button, Text, TextInput, Form, FormField, 
  Footer, Anchor, RadioButtonGroup, TextArea, Select } from 'grommet';
import { hpe } from "grommet-theme-hpe";
import { Home, Moon, Sun, Console, Desktop, StatusGood, StatusCritical, Run, Trash, HostMaintenance, System } from 'grommet-icons';
import regions from './regions';

function App() {
  const [theme, setTheme] = React.useState('light');
  const [output, setOutput] = React.useState([]);
  const [showoutput, setShowoutput] = React.useState(false);
  const [error, setError] = React.useState(undefined);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [provider, setProvider] = React.useState();
  const [providers, setProviders] = React.useState();
  const [config, setConfig] = React.useState({});
  const [showconfig, setShowconfig] = React.useState(false);
  const [logfile, setLogfile] = React.useState(false);
  const [spin, setSpin] = React.useState(false);
  const [gwurl, setGwurl] = React.useState(undefined);
  const [gwready, setGwready] = React.useState(false);
  const [MCSready, setMCSready] = React.useState(false);
  const [prvkey, setPrvkey] = React.useState(false);
  const [tfstate, setTfstate] = React.useState(false);
  const outputRef = React.useRef(undefined);

  React.useEffect(() => {
    const fetchData = async () => {
      fetch('/providers')
      .then(res => res.json())
      .then(
        (result) => {
          setIsLoaded(true);
          setProviders(result);
        },
        (error) => {
          setIsLoaded(true);
          setError(error.message);
        }
      )
    };
    if (! isLoaded) fetchData();
  }, [isLoaded]);

  const fetchData = async (url) => {
    return await fetch(url, {})
  }
  
  const postData = async (url = '', data = {}) => {
    const fetchParams = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    };
    const response = await fetch(url, fetchParams);
    return response;
  }

  const checkExistingRun = async (provider) => {
    const response = await fetchData(`/isfile/${provider.toLowerCase()}/run.log`);
    return response.ok;
  }
  
  const configureProvider = (val) => {
    setProvider(val);
    setShowconfig(true);
    checkExistingRun(val).then(res => { if (res) setLogfile(true) } );
    fetchData(`/${val.toLowerCase()}/config`)
      .then(response => {
        if (! response.ok) setError(response.statusText)
        return response.json();
      })
      .then(
        (result) => { setConfig(result); },
        (error) => { console.error(error); setError(error.message) }
      );
  }

  const processResponse = (responseBody) => {
    setSpin(true); // start spinning
    setError(undefined); // clear up errors
    setShowconfig(false); // automatically close config form
    setShowoutput(true); // show output
    const reader = responseBody.getReader();
    return new ReadableStream({
      start(controller) {
        const reg = new RegExp('^fatal:','gm');
        function push() {
          reader.read().then( ({done, value}) => {
            if (done) {
              // finished with the stream
              controller.close();
              setSpin(false);
              return;
            }
            controller.enqueue(value);
            const textVal = new TextDecoder().decode(value);
            // Capture fatal errors
            if (reg.test(textVal)) setError(textVal);
            if (textVal.includes('...ignoring')) setError(undefined);
            // Capture the gateway dns name
            if (textVal.includes('gateway_public_dns = [')) {
              setGwurl(textVal.split('gateway_public_dns = [')[1].split('"')[0]); // extract the IP
              setTfstate(true);
            }
            // when gateway installation is complete
            if (textVal.includes('TASK [exit site lockdown]'))
              setGwready(true);
            // if External Data Fabric console ready
            if (textVal.includes('TASK [MCS tunnel admin]'))
              setMCSready(true);
            if (textVal.includes('Environment destroyed'))
            {
              setPrvkey(false);
              setError(undefined);
            }
            // capture errors in output
            if (textVal.includes('Terraform has been successfully initialized!'))
              setPrvkey(true);
            setOutput( old => [...old, textVal] );
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
            push();
          })
        }
        setError(undefined);
        push();
      }
    });
  }

  const deploy = () =>
    postData(`/${provider.toLowerCase()}/deploy`, config)
    .then(response => response.body)
    .then(rb => processResponse(rb))
    .then(stream => new Response(stream, { headers: { "Content-Type": "text/html" } }).text())
    .then(result => setLogfile(result));

  const destroy = () =>
    postData(`/${provider.toLowerCase()}/destroy`, config)
    .then(response => response.body)
    .then(rb => processResponse(rb))
    .then(stream => new Response(stream, { headers: { "Content-Type": "text/html" } }).text())
    .then(result => setGwurl(undefined) );

  // const log = () =>
  //   fetchData(`/${provider.toLowerCase()}/log`)
  //   .then(response => response.body)
  //   .then(rb => processResponse(rb))
  //   .then(stream => new Response(stream, { headers: { "Content-Type": "text/html" } }).text())
  //   .then(result => console.dir(result) && setGwurl(undefined) );

  const reset = () => {
    // configureProvider(providers[0]);
    setProvider(null);
    setConfig({});
    setShowconfig(false);
    setOutput([]);
    setShowoutput(false);
    setGwurl(undefined);
    setMCSready(false);
    setLogfile(undefined);
    setError(undefined);
  }

  return (
    <Grommet theme={hpe} themeMode={theme} full>
      <Box fill>
      {/* Navigation Bar */}
      <Box direction='row' justify='between'>
        <Button icon={ <Home /> } onClick={ () => reset() } />
        {/* Providers */}
        <Box animation='zoomIn'>
          { providers && <RadioButtonGroup id='target-id' 
            name='target' 
            direction='row'
            justify='evenly'
            options={ providers }
            value={ provider }
            onChange={ e => configureProvider(e.target.value) } 
          />}
        </Box>
        <Box direction='row' justify='end'>
          <CheckBox
            toggle reverse
            label={ theme === 'dark' ? <Moon /> : <Sun /> }
            checked={ theme === 'dark' ? false : true }
            onChange={ () => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          { <CheckBox 
            toggle reverse
            label={ showoutput ? <Console /> : <Desktop /> }
            checked={ showoutput ? true : false }
            onChange={ () => setShowoutput(!showoutput) }
          /> }
          { <CheckBox 
            toggle reverse
            label={ showconfig ? <HostMaintenance /> : <System /> }
            checked={ showconfig ? true : false }
            onChange={ () => setShowconfig(!showconfig) }
          /> }
        </Box>
      </Box>
      {/* Configure */}
      {/* <Button 
          alignSelf='end' 
          plain pad='xsmall'
          label={ showconfig ? 'Hide config' : 'Show config' } 
          onClick={ () => setShowconfig(!showconfig) } />  */}
      { showconfig && 
        <Card margin="small" animation='zoomIn' overflow="auto">
          <Form
            value= { config }
            validate='change' 
            onChange= { (value) => setConfig(value) }
            >
              {/* { Object.keys(config).map( key => 
                  <FormField name={key} htmlfor={key} label={ key.replace('is_', '') } key={key} required={ !key.includes('is_') } margin="small">
                      { key.includes('is_') ?
                        <CheckBox toggle reverse key={key} label={key.replace('is_','')} checked={ config[key] } onChange={ (e) => setConfig( old => ( {...old, [key]: !old[key] }) ) } />
                        :
                        <TextInput placeholder={key} id={key} name={key} value={ config[key] } type={ key.includes('password') || key.includes('secret') ? 'password' : 'text' } />
                      }
                  </FormField>
                )} */}
              { Object.keys(config).filter(k => !k.includes('is_') && !k.includes('region')).map( key => 
                  <FormField name={key} htmlfor={key} label={ key.replace('is_', '') } key={key} required={ !key.includes('is_') } margin="small">
                        <TextInput placeholder={key} id={key} name={key} value={ config[key] } type={ key.includes('password') || key.includes('secret') ? 'password' : 'text' } />
                  </FormField>
                )}
                { (provider.toLowerCase() === "aws" || provider.toLowerCase() === "azure") && <FormField name='region' htmlfor='region' label='region' key='region' required={ true } margin="small">
                        <Select placeholder='Region' id='region' name='region' 
                          options={regions[provider.toLowerCase()]}
                          onChange={({ option }) => setConfig( old => ( {...old, 'region': option }) )  }
                          value={ config['region'] } />
                  </FormField>
                }
                <CardFooter>
                  <Box direction='row' justify='center'>
                    <CheckBox toggle reverse label='Verbose' checked={ config['is_verbose'] } onChange={ () => setConfig( old => ( {...old, 'is_verbose': !old['is_verbose'] }) ) } />
                    <CheckBox toggle reverse label='MLOps' checked={ config['is_mlops'] } onChange={ () => setConfig( old => ( {...old, 'is_mlops': !old['is_mlops'] }) ) } />
                    <CheckBox toggle reverse label='GPU Worker' checked={ config['is_gpu'] } onChange={ () => setConfig( old => ( {...old, 'is_gpu': !old['is_gpu'] }) ) } />
                    <CheckBox toggle reverse label='Standalone DF' checked={ config['is_mapr'] } onChange={ () => setConfig( old => ( {...old, 'is_mapr': !old['is_mapr'] }) ) } />
                    <CheckBox toggle reverse label='Enable HA (CP only)' checked={ config['is_ha'] } onChange={ () => setConfig( old => ( {...old, 'is_ha': !old['is_ha'] }) ) } />
                  </Box>
                </CardFooter>
            </Form>
        </Card> }
      {/* Run */}
      { provider && (! Object.values(config).some(v => v===""))
        && <Box animation='zoomIn' direction='row' justify='between' margin='none'>
        <Button 
          label={ 'Deploy on ' + provider } 
          icon={ <Run /> } 
          onClick={ () => window.confirm('Installation will start') && deploy() } 
          margin='none' 
        />
        { spin && <Text color='status-warning'>Please wait...</Text> }
      </Box>}

        <Box pad='small' fill flex animation='zoomIn' overflow='scroll'>
          { showoutput && 
            <Card margin="small" fill flex>
              <TextArea 
                readOnly 
                fill flex
                ref={ outputRef }
                value={ output.join('') }
                size='xsmall'
                plain
                style={{ whiteSpace: 'pre', fontFamily: 'Consolas,Courier New,monospace' }} />
            </Card>
          }
        </Box>

      {/* Footer */}
      <Box justify='end'>
        <Footer background='brand' pad="xsmall">
          <Fragment>
            { error ? <StatusCritical color='status-critical' /> : <StatusGood color='status-ok' /> }
            { error && <Text color='red' tip={ error }>{ error.substr(0, 40) + '...' }</Text> }
            { gwurl && <Anchor label='ECP Gateway' href={ "https://" + gwurl } target='_blank' rel='noreferrer' disabled={ !gwready } tip={ gwurl } /> }
            { config['is_mapr'] && MCSready && <Anchor label='MCS' href="https://localhost:8443" target='_blank' rel='noreferrer' disabled={ !MCSready } tip="External Data Fabric Management Console" /> }
            { config['is_mapr'] && MCSready && <Anchor label='MCS Installer' href="https://localhost:9443" target='_blank' rel='noreferrer' disabled={ !MCSready } tip="External Data Fabric Installer" /> }
            { logfile && <Anchor label="Logs" href={`/file/${provider.toLowerCase()}/run.log`} rel='noreferrer' /> }
            { prvkey && <Anchor label="Private Key" href={`/file/generated/controller.prv_key`} rel='noreferrer' /> }
            { tfstate && <Anchor label="TF State" href={`/file/${provider.toLowerCase()}/terraform.tfstate`} rel='noreferrer' /> }
            { prvkey && <Button label='Destroy' alignSelf='end'
              icon={ <Trash color="status-critical" /> } 
              tip='Destroy the environment' 
              onClick={ () => window.confirm('All will be deleted') && destroy() } 
            /> }
          </Fragment>
          <Box direction='row'>
            <Text margin={ { right: 'small' } }>HPE Ezmeral @2022 </Text>
            <Anchor label='About' onClick={ () => alert('https://github.com/hpe-container-platform-community/ezdemo for issues and suggestions.') } />
          </Box>
        </Footer>
      </Box>
    </Box>
  </Grommet>
  );
}

export default App;
