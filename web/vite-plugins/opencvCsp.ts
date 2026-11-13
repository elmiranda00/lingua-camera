// Vite plugin: makes OpenCV.js run under our CSP (no eval, no data: fetch)
// Patterns match @techstark/opencv-js 4.10.0-release.1; the unit test fails if they stop matching.
import type { Plugin } from "vite";

// createNamedFunction: a wrapper that forwards to `body`
const NAMED = /(?:new\s+)?Function\(\s*(["'`])body\1\s*,[\s\S]{0,400}?\)\(\s*([\w$]+)\s*\)/g;
// dynCall wrapper: (dynCall, rawFunction) => (...args) => dynCall(rawFunction, ...args)
const DYN =
  /(?:new\s+)?Function\(\s*(["'`])dynCall\1\s*,\s*(["'`])rawFunction\2\s*,\s*[\w$]+\s*\)\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)/g;
// Embind invokers: the same steps as the generated code (wire args, call C++, run destructors, read result)
const INVOKER_FROM = "args1.push(invokerFnBody);var invokerFunction=new_(Function,args1).apply(null,args2);return invokerFunction}";
const INVOKER_TO =
  "return function(){" +
  'if(arguments.length!==argCount-2){throwBindingError("function "+humanName+" called with "+arguments.length+" arguments, expected "+(argCount-2)+" args!")}' +
  "var destructors=needsDestructorStack?[]:null;var thisWired;var argsWired=[];var call=[cppTargetFunc];" +
  "if(isClassMethodFunc){thisWired=argTypes[1].toWireType(destructors,this);call.push(thisWired)}" +
  "for(var i=0;i<argCount-2;++i){argsWired.push(argTypes[i+2].toWireType(destructors,arguments[i]))}" +
  "var rv=cppInvokerFunc.apply(null,call.concat(argsWired));" +
  "if(needsDestructorStack){runDestructors(destructors)}else{for(var i=isClassMethodFunc?1:2;i<argTypes.length;++i){" +
  "if(argTypes[i].destructorFunction!==null){argTypes[i].destructorFunction(i===1?thisWired:argsWired[i-2])}}}" +
  "if(returns){return argTypes[0].fromWireType(rv)}}}";
// emval method caller (C++ calling a JS method)
const CALLER_FROM =
  "params.push(functionBody);var invokerFunction=new_(Function,params).apply(null,args);return __emval_addMethodCaller(invokerFunction)}";
const CALLER_TO =
  "var invokerFunction=function(handle,name,destructors,argsPtr){var a=[];var offset=0;" +
  'for(var i=0;i<argCount-1;++i){a.push(types[1+i].readValueFromPointer(argsPtr+offset));offset+=types[1+i]["argPackAdvance"]}' +
  "var rv=handle[name].apply(handle,a);" +
  'for(var i=0;i<argCount-1;++i){if(types[1+i]["deleteObject"]){types[1+i].deleteObject(a[i])}}' +
  "if(!retType.isVoid){return retType.toWireType(destructors,rv)}};return __emval_addMethodCaller(invokerFunction)}";
// The WASM is embedded as a data: URL; skip the fetch (blocked by connect-src) and decode it directly
const DATA_FETCH = /(typeof fetch\s*===\s*"function")(\s*\)\s*\{\s*return fetch\(wasmBinaryFile)/;

export function patchOpencv(code: string): string {
  return code
    .replace(NAMED, (_m, _q, body: string) => `(function(){return ${body}.apply(this,arguments)})`)
    .replace(DYN, (_m, _q1, _q2, dyn: string, raw: string) => `(function(){return ${dyn}(${raw},...arguments)})`)
    .replace(DATA_FETCH, "$1&&!isDataURI(wasmBinaryFile)$2")
    .replace(INVOKER_FROM, INVOKER_TO)
    .replace(CALLER_FROM, CALLER_TO);
}

// PaddleOCR's prebuilt worker bundles its own ONNX Runtime (WebGPU build, too big to host). We use our own worker.
const PREBUILT_WORKER = /worker-entry-[\w-]+\.js(\.map)?$/;

export function opencvCsp(): Plugin {
  return {
    name: "opencv-csp",
    transform(code, id) {
      if (!/[\\/]@techstark[\\/]opencv-js[\\/]/.test(id)) return null;
      return { code: patchOpencv(code), map: null };
    },
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (PREBUILT_WORKER.test(name)) delete bundle[name];
      }
    },
  };
}
