var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { DeepClient, parseJwt } from "@deep-foundation/deeplinks/imports/client.js";
import { gql } from '@apollo/client/index.js';
import memoize from 'lodash/memoize.js';
import http from 'http';
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
function dynamicImport(moduleName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const module = yield import(moduleName);
            const functionName = Object.keys(module.default)[0];
            return module.default[functionName];
        }
        catch (error) {
            return { error: `Dynamic import error: ${error.message}` };
        }
    });
}
const compileKotlinToJs = (kotlinCode) => {
    const tmpFile = tmp.fileSync({ postfix: '.kt' });
    fs.writeFileSync(tmpFile.name, kotlinCode);
    try {
        const compileCommand = `/opt/kotlin/bin/kotlinc-js -output ${tmpFile.name.replace('.kt', '.cjs')} -module-kind commonjs ${tmpFile.name}`;
        execSync(compileCommand);
        return tmpFile.name.replace('.kt', '.cjs');
    }
    catch (error) {
        const errorMessage = `Kotlin compilation error: ${error.message}`;
        console.error(errorMessage);
        return { error: errorMessage };
    }
};
const makeFunctionKotlin = (code) => __awaiter(void 0, void 0, void 0, function* () {
    const jsFilePath = compileKotlinToJs(code);
    if (jsFilePath.error !== undefined) {
        return { error: jsFilePath.error };
    }
    else {
        try {
            const module = yield dynamicImport(jsFilePath);
            return module;
        }
        catch (error) {
            return { error: error.message };
        }
    }
});
const makeDeepClient = (token) => {
    if (!token)
        throw new Error('No token provided');
    const decoded = parseJwt(token);
    const linkId = decoded === null || decoded === void 0 ? void 0 : decoded.userId;
    const apolloClient = generateApolloClient({
        path: GQL_URN,
        ssl: !!+GQL_SSL,
        token,
    });
    const deepClient = new DeepClient({ apolloClient, linkId, token });
    deepClient.import = (path) => __awaiter(void 0, void 0, void 0, function* () {
        let module;
        try {
            module = require(path);
        }
        catch (e) {
            if (e.code === 'ERR_REQUIRE_ESM') {
                module = yield import(path);
            }
            else {
                throw e;
            }
        }
        return module;
    });
    return deepClient;
};
const requireWrapper = (id) => {
    return require(id);
};
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.get('/healthz', (req, res) => {
    res.json({});
});
app.post('/init', (req, res) => {
    res.json({});
});
app.post('/call', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        console.log('call body params', (_a = req === null || req === void 0 ? void 0 : req.body) === null || _a === void 0 ? void 0 : _a.params);
        const { jwt, code, data } = ((_b = req === null || req === void 0 ? void 0 : req.body) === null || _b === void 0 ? void 0 : _b.params) || {};
        const fn = yield makeFunctionKotlin(code);
        if (fn.error !== undefined) {
            console.log('rejected', fn.error);
            res.json({ rejected: fn.error });
        }
        else {
            const deep = makeDeepClient(jwt);
            const result = yield fn({ data, deep, gql, require: requireWrapper });
            console.log('call result', result);
            res.json({ resolved: result });
        }
    }
    catch (rejected) {
        const processedRejection = JSON.parse(toJSON(rejected));
        console.log('rejected', processedRejection);
        res.json({ rejected: processedRejection });
    }
}));
app.use('/http-call', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const options = decodeURI(`${req.headers['deep-call-options']}`) || '{}';
        console.log('deep-call-options', options);
        const { jwt, code, data } = JSON.parse(options);
        const fn = yield makeFunctionKotlin(code);
        if (fn.error !== undefined) {
            console.log('rejected', fn.error);
            res.json({ rejected: fn.error });
        }
        else {
            const deep = makeDeepClient(jwt);
            yield fn(req, res, next, { data, deep, gql, require: requireWrapper });
        }
    }
    catch (rejected) {
        const processedRejection = JSON.parse(toJSON(rejected));
        console.log('rejected', processedRejection);
        res.json({ rejected: processedRejection });
    }
}));
http.createServer({ maxHeaderSize: 10 * 1024 * 1024 * 1024 }, app).listen(process.env.PORT);
console.log(`Listening ${process.env.PORT} port`);
//# sourceMappingURL=index.js.map