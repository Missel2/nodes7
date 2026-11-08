'use strict';
// Candidate-only lifecycle checks. These are not substitutes for the
// exact-original-red / same-test-candidate-green COTP proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {Duplex} = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const {S7Endpoint} = require('../../src/index.js');
const OUT = path.resolve(__dirname, '../../test-reports');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function deadline(p, ms, label) {
    let timer;
    return Promise.race([
        Promise.resolve(p),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('HARNESS_TIMEOUT '+label)),ms);})
    ]).finally(()=>clearTimeout(timer));
}
async function snapshotState(promise, ms) {
    const token = Symbol('pending');
    const settled = await Promise.race([
        Promise.resolve(promise).then(()=> 'fulfilled', ()=> 'rejected'),
        sleep(ms).then(()=>token)
    ]);
    return settled===token?'pending':settled;
}
function save(name, evidence) {
    fs.mkdirSync(OUT,{recursive:true});
    fs.writeFileSync(path.join(OUT,name),JSON.stringify({hardware:false,platform:process.platform,node:process.version,...evidence},null,2)+'\n');
}

test('six repeated real COTP setup cancellations leave no live peer sockets', {timeout:14000}, async () => {
    const peers = new Set();
    let nextRequest, accepted = 0, liveConnected = 0;
    const server = net.createServer(socket=>{
        accepted++;
        peers.add(socket);
        socket.on('error',()=>{});
        socket.once('close',()=>peers.delete(socket));
        let bytes=Buffer.alloc(0);
        socket.on('data',chunk=>{
            bytes=Buffer.concat([bytes,chunk]);
            if(bytes.length>=22&&nextRequest){
                const announce=nextRequest;
                nextRequest=null;
                announce({socket,bytes});
            }
        });
    });
    await deadline(new Promise((resolve,reject)=>{
        server.once('error',reject);
        server.listen(0,'127.0.0.1',resolve);
    }),3000,'listen');
    const endpoint = new S7Endpoint({host:'127.0.0.1',port:server.address().port,rack:0,slot:1,autoReconnect:0});
    endpoint.on('connect',()=>liveConnected++);
    endpoint.on('error',()=>{});
    const evidence={case:'six repeated pending handshakes with explicit disconnect',cycles:[]};
    try {
        for(let i=0;i<6;i++){
            const packet = new Promise(resolve=>{nextRequest=resolve});
            const connecting=endpoint.connect();
            const receiving=await deadline(packet,3000,'COTP request '+i);
            assert.equal(receiving.bytes.readUInt16BE(2),22);
            assert.equal(receiving.bytes[5],0xe0);
            const closing=new Promise(resolve=>receiving.socket.once('close',resolve));
            const disconnect=await snapshotState(endpoint.disconnect(),600);
            const peerClose=await snapshotState(closing,600);
            const connectState=await snapshotState(connecting,200);
            const status={cycle:i+1,disconnect,peerClose,connectState,
                peersBeforeFixtureCleanup:peers.size,lateConnectedEvents:liveConnected};
            evidence.cycles.push(status);
            assert.equal(disconnect,'fulfilled','public disconnect never hangs');
            assert.equal(peerClose,'fulfilled','TCP peer must close without fixture assistance');
            assert.equal(connectState,'rejected','cancelled connect never silently succeeds');
            assert.equal(peers.size,0,'each cycle cleans all sockets');
            assert.equal(liveConnected,0,'cancelled connection cannot report connected');
        }
        assert.equal(accepted,6);
        assert.equal(endpoint.isConnected,false);
    } finally {
        save('n7-cotp-repeated-cycles.json',evidence);
        for(const peer of peers) peer.destroy();
        await deadline(new Promise(resolve=>server.close(resolve)),3000,'server.close');
    }
});

test('late custom transport resolution is destroyed after user cancellation', {timeout:6000}, async()=>{
    let resolveLate;
    const promise=new Promise(resolve=>{resolveLate=resolve});
    const endpoint=new S7Endpoint({customTransport:()=>promise,autoReconnect:0});
    let connected=0;
    endpoint.on('connect',()=>connected++);
    endpoint.on('error',()=>{});
    const connecting=endpoint.connect();
    await sleep(20); // lets the custom-transport Promise be registered
    const dis=await snapshotState(endpoint.disconnect(),600);
    const connectState=await snapshotState(connecting,250);
    const late=new Duplex({read(){},write(_data,_encoding,cb){cb()}});
    let closed=false;
    late.once('close',()=>{closed=true});
    resolveLate(late);
    await deadline(new Promise((resolve,reject)=>{
        if(closed)return resolve();
        late.once('close',resolve);
    }),1000,'late custom transport must be destroyed');
    await sleep(40);
    save('n7-late-custom-transport.json',{disconnect:dis,connectState,
        lateStreamDestroyed:late.destroyed,lateStreamCloseObserved:closed,
        lateConnectEvents:connected,endpointConnected:endpoint.isConnected});
    assert.equal(dis,'fulfilled');
    assert.equal(connectState,'rejected');
    assert.equal(late.destroyed,true);
    assert.equal(closed,true);
    assert.equal(connected,0);
    assert.equal(endpoint.isConnected,false);
});
