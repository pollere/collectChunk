# collectChunk - nodejs program to serve line-by-line input into chunks

## Summary

collectChunk is a command line nodejs program that collects lines
from its input stream and sends them on a websocket at a regular interval
(timeSpan) The timeSpan is a millisecond value sent from the
client web page (defaults to 1 sec).  The timeSpan can be changed by
the consuming web client.

collectChunk can be used to "chunk" any line-by-line output
stream into chunks sent at some time span specified by the client.

## Usage

collectChunk requires nodejs (https://nodejs.org) and the packages 'ws' and
'websocket-stream'.

pping -i interface -m | node.js collectChunk.js
OR
cat [some file of ppings] | node.js collectChunk.js

then either "open `index.html`" from command line or navigate to `index.html`
from localhost web page. (This can be used with `ppvizCLI.html` from Pollere's
in-progress `ppviz` project for the adventurous.)

Note that the input to this file doesn't have to be ppings, just any
source of lines with a first field of time in seconds.  
A simple test can be peformed by executing the command line:

cat tst.pp | node collectChunk.js

And then open index.html in a browser window. The browser window will display
and scroll the output lines. `index.html` can be used with `pping` to view its
output in a browswer window and can also be used as a template for more
sophisticated client viewers.

## Examples

## See Also

`pping` at https://github/pollere/pping.
`ppviz` at https://github/pollere/ppviz.

## Author

Kathleen Nichols <nichols@pollere.net>.

## Copyright

Copyright (c) 2018, Kathleen Nichols <nichols@pollere.net>.

Licensed under the GNU GPLv3. See LICENSE for more details.
