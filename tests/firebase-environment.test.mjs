import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

const source=await readFile(new URL('../src/lib/firebase.ts',import.meta.url),'utf8');
const bundled={apiKey:'bundled-key',authDomain:'bundled.firebaseapp.com',projectId:'bundled-production',storageBucket:'bundled.appspot.com',messagingSenderId:'111',appId:'bundled-app',measurementId:'G-BUNDLED',firestoreDatabaseId:'bundled-database'};
const env={VITE_FIREBASE_API_KEY:'staging-key',VITE_FIREBASE_AUTH_DOMAIN:'staging.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'isolated-staging',VITE_FIREBASE_STORAGE_BUCKET:'staging.appspot.com',VITE_FIREBASE_MESSAGING_SENDER_ID:'222',VITE_FIREBASE_APP_ID:'staging-app',VITE_FIREBASE_MEASUREMENT_ID:'G-STAGING',VITE_FIREBASE_FIRESTORE_DATABASE_ID:'isolated-database'};

async function initialize(environment){
 const result=await build({entryPoints:['src/lib/firebase.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify(environment)},plugins:[{
  name:'capture-firebase-destinations',setup(api){
   api.onLoad({filter:/firebase-applet-config\.json$/},()=>({loader:'json',contents:JSON.stringify(bundled)}));
   api.onResolve({filter:/^firebase\//},args=>({path:args.path,namespace:'firebase-test'}));
   api.onLoad({filter:/.*/,namespace:'firebase-test'},args=>{
    const declarations=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](firebase\/[^"']+)["']/g)].filter(m=>m[2]===args.path).flatMap(m=>m[1].split(',').map(name=>name.trim().split(/\s+as\s+/)[0]).filter(Boolean));
    const implementations={initializeApp:'config=>({config})',getApps:'()=>[]',getApp:'()=>{throw Error("Unexpected existing app")}',getAuth:'app=>({app})',getFirestore:'(app,databaseId="(default)")=>({app,databaseId})',getStorage:'(app,bucket)=>({app,bucket})',isSupported:'async()=>false'};
    return {loader:'js',contents:declarations.map(name=>`export const ${name}=${implementations[name]??'()=>undefined'};`).join('\n')};
   });
  }
 }]});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('explicit staging environment config reaches Firebase app and named Firestore database',async()=>{
 const {app,db}=await initialize({...env,VITE_FIREBASE_CONFIG_SOURCE:'environment'});
 assert.deepEqual(app.config,{apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:env.VITE_FIREBASE_APP_ID,measurementId:env.VITE_FIREBASE_MEASUREMENT_ID});
 assert.equal(db.databaseId,'isolated-database');
});

test('an explicit default database does not reuse the bundled named database',async()=>{
 const {db}=await initialize({...env,VITE_FIREBASE_CONFIG_SOURCE:'environment',VITE_FIREBASE_FIRESTORE_DATABASE_ID:'(default)'});
 assert.equal(db.databaseId,'(default)');
});

test('builds without environment overrides retain the bundled Firebase destinations',async()=>{
 const {app,db}=await initialize({});
 const {firestoreDatabaseId,...expected}=bundled;
 assert.deepEqual(app.config,expected);
 assert.equal(db.databaseId,firestoreDatabaseId);
});

test('existing environment variables do not change a bundled deployment without an explicit opt-in',async()=>{
 const {app,db}=await initialize(env);
 assert.equal(app.config.projectId,bundled.projectId);
 assert.equal(db.databaseId,bundled.firestoreDatabaseId);
});

test('an incomplete environment configuration fails before Firebase initializes',async()=>{
 await assert.rejects(()=>initialize({VITE_FIREBASE_CONFIG_SOURCE:'environment',VITE_FIREBASE_PROJECT_ID:'isolated-staging'}),/Firebase environment configuration is incomplete/);
});
