import express from 'express';
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { gql } from '@apollo/client/index.js';
import memoize from 'lodash/memoize.js';
import http from 'http';
// import { parseStream, parseFile } from 'music-metadata';
import { createRequire } from 'node:module';
import bodyParser from 'body-parser';
const require = createRequire(import.meta.url);

const memoEval = memoize(eval);

const app = express();

const GQL_URN = process.env.GQL_URN || 'localhost:3006/gql';
const GQL_SSL = process.env.GQL_SSL || 0;

const toJSON = (data) => JSON.stringify(data, Object.getOwnPropertyNames(data), 2);

const { execSync } = require('child_process');
const fs = require('fs');
const tmp = require('tmp-promise');

const compileKotlinToJs = (kotlinCode: string) => {
  const tmpFile = tmp.fileSync({ postfix: '.kt' });
  fs.writeFileSync(tmpFile.name, kotlinCode);

  try {
    const compileCommand = `kotlinc-js -output ${tmpFile.name.replace('.kt', '.js')} ${tmpFile.name}`;
    execSync(compileCommand);
    return tmpFile.name.replace('.kt', '.js');
  } catch (error) {
    console.error('Kotlin compilation error:', error);
    throw new Error('Kotlin compilation error');
  }
}

const makeFunctionKotlin = (code: string) => {
  try {
    const jsFilePath = compileKotlinToJs(code);
    const fn = require(jsFilePath);
    if (typeof fn !== 'function')
    {
      throw new Error("Executed handler's code didn't return a function.");
    }
    return fn;
  } catch (error) {
    console.error('Error creating function:', error);
    throw new Error('Error creating function');
  }
}


const makeDeepClient = (token: string) => {
  if (!token) throw new Error('No token provided');
  const decoded = parseJwt(token);
  const linkId = decoded?.userId;
  const apolloClient = generateApolloClient({
    path: GQL_URN,
    ssl: !!+GQL_SSL,
    token,
  });
  const deepClient = new DeepClient({ apolloClient, linkId, token }) as any;
  deepClient.import = async (path: string) => {
    let module;
    try {
      module = require(path)
    } catch (e) {
      if (e.code === 'ERR_REQUIRE_ESM') {
        module = await import(path)
      } else {
        throw e;
      }
    }
    return module;
  };
  return deepClient;
}

const requireWrapper = (id: string) => {
  // if (id === 'music-metadata') {
  //   return { parseStream, parseFile };
  // }
  return require(id);
}

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.get('/healthz', (req, res) => {
  res.json({});
});
app.post('/init', (req, res) => {
  res.json({});
});
app.post('/call', async (req, res) => {
  try {
    console.log('call body params', req?.body?.params);
    const { jwt, code, data } = req?.body?.params || {};
    const fn = makeFunctionKotlin(code);
    const deep = makeDeepClient(jwt);
    const result = await fn({ data, deep, gql, require: requireWrapper }); // Supports both sync and async functions the same way
    console.log('call result', result);
    res.json({ resolved: result });
  }
  catch(rejected)
  {
    const processedRejection = JSON.parse(toJSON(rejected));
    console.log('rejected', processedRejection);
    res.json({ rejected: processedRejection });
  }
});

app.use('/http-call', async (req, res, next) => {
  try {
    const options = decodeURI(`${req.headers['deep-call-options']}`) || '{}';
    console.log('deep-call-options', options);
    const { jwt, code, data } = JSON.parse(options as string);
    const fn = makeFunctionKotlin(code);
    const deep = makeDeepClient(jwt);
    await fn(req, res, next, { data, deep, gql, require: requireWrapper }); // Supports both sync and async functions the same way
  }
  catch(rejected)
  {
    const processedRejection = JSON.parse(toJSON(rejected));
    console.log('rejected', processedRejection);
    res.json({ rejected: processedRejection }); // TODO: Do we need to send json to client?
  }
});

http.createServer({ maxHeaderSize: 10*1024*1024*1024 }, app).listen(process.env.PORT);
console.log(`Listening ${process.env.PORT} port`);