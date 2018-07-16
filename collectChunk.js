/* 
    collectChunk - input piped from standard io, creates localhost server

    Copyright (c) 2018 Kathleen Nichols, Pollere, Inc.

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

    This is a nodejs program to collect line-by-line input that is piped into
    it from the standard input and pipe it out in chunks of that are spaced
    at timeSpan intervals, timeSpan being a millisecond value sent from the
    downstream piped web page. 
    To serve multiple clients, need to attach multiple writable streams to
    the stdin-to-transform pipeline and resolve the interval choice.

    example usage: pping -i interface -m | node.js line2Chunk.js
        OR cat [some file of ppings] | node.js line2Chunk.js 
        then either "open ppvizCLI.html" from command line or localhost web page
    Note1: that the input to this file doesn't have to be ppings, just any
        source of lines with a first field of time in seconds.
    Note2: the html file doesn't have to be ppvizCLI.html and can be any
        properly set up web page, e.g. the included index.html for testing
*/

'use strict';

let blockSize = 10 * 1024;  //bytes
process.stdin.setEncoding('utf8');

const WebSocketServer = require('ws').Server;
const WebSocketStream = require('websocket-stream');
const { Transform, pipeline } = require('stream');

function sleep(time)   {    //time in milliseconds
    return new Promise (resolve => setTimeout(resolve, time))
}

let timeSpan = 1000;        //sending interval in ms, default value
let lineArr = [];
let intervalTimer;  //output chunk timer
let EOI = false;    //end of input flag
let collectIntervalFlushCB; //so flush() callback() routine can be deferred
let lastTime;       //start of last send interval in input stream time
let frag = "";      //to keep any line fragment

//send all the lines in the line array
function  sendInterval (ts) {
    lastTime = Date.now();
    let outString = '';
    while(lineArr.length) { 
        outString += lineArr.shift();
    }
    if(outString.length) {
        ts.push(outString);
    }
    //no more input and nothing left to send
    if(!lineArr.length && EOI) {
        clearInterval(intervalTimer);
        collectIntervalFlushCB();
    }
};

/*web client changed the message chunk spacing
    A shorter timeSpan can lead to additional lag with this approach.
    Could send a one-time large chunk on change to preserve lag.
*/
async function resetInterval() {
    clearInterval(intervalTimer);
    //wall clock time since last send in ms
    const elapsed = Date.now() - lastTime;
    if(elapsed < timeSpan) {
        await sleep( timeSpan - elapsed );
    }
    sendInterval(collectInterval);
    intervalTimer = setInterval(sendInterval, timeSpan, collectInterval);
}


let collectInterval = new Transform({
    readableObjectMode: true,

    transform(chunk, encoding, callback) {
        //transform chunk to string and append to lineArr in lines
        //add this chunk to the lineArr
        chunk.toString().split(/^/m)
            .forEach((line, index) => {
                if(index === 0 && frag.length) {
                    line = frag.concat(line);
                    frag = "";
                }
                if(line.endsWith("\n")) {
                    lineArr.push(line);
                } else {
                    frag = line;
                }
            });

        callback();
    }
,
    //set EOI indicator, delay the end event for the Readable stream(output)
    flush(callback) {
        EOI = true;
        collectIntervalFlushCB = callback.bind(this);
    }
});

collectInterval.setEncoding('utf8');    //Readable stream reads as string

let activeStream = false;

let wss = new WebSocketServer({
    host: '127.0.0.1',
    port: 8080,
    perMessageDeflate: false,
    verifyClient: function( info ) { return !activeStream; },
    maxPayload: blockSize});

    //set up first part of the pipeline
    //collectInterval's writeable should pause when readable is full
    let pipeInterval = process.stdin.pipe(collectInterval);

wss.on('connection', function (ws) {
    let stream;
    ws.on('message', function(msg) {
        //consume the message
        let cmd = msg.split(' ');
        if(cmd.length === 2 && cmd[0] === 'timespan') {
            timeSpan = parseInt(cmd[1]);
        }
        //if first msg set up the client stream and pipe
        if(!stream) {
            stream = WebSocketStream(ws, {objectMode: true});
            stream.setEncoding('utf8');
            activeStream = true;
            pipeInterval.pipe(stream);
            sendInterval(collectInterval); //send what we have so far
            //start the send interval timer
            intervalTimer = setInterval(sendInterval,timeSpan,collectInterval);
/*
            pipeline( process.stdin, collectInterval, stream,
                      (err) => {
                          if (err) {
                              console.error("pipeline failed:", err);
                          } else {
                              console.log('EOF');
                          }
//                          this.close(1000, 'done');
//                          process.exit(0);
                      });
*/
        }
        else if(intervalTimer) {    //new interal timespan
            resetInterval();
        }
    });

    ws.on('close', function(connection) {
        console.log((new Date()) + ": disconnected");
        pipeInterval.unpipe(stream);
        activeStream = false;
        stream = undefined;
        clearInterval(intervalTimer);
    });
});
