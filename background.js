/*

 https://stackoverflow.com/questions/27661243/how-to-debug-chrome-devtools-panel-extension

 */

// Chrome automatically creates a background.html page for this to execute.
// This can access the inspected page via executeScript
//
// Can use:
// chrome.tabs.*
// chrome.extension.*

var debug = function( o ){
    //console.log('[background.js]: ' + JSON.stringify( o ) );
    //console.log('== [background.js] ==' );
    console.log( o );
}

chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {

    if ( request && request.type ){
        switch ( request.type ){
            case 'debug' : {
                debug ( request.content );
                sendResponse({
                    type: 'debug.response',
                    content: 'ok'
                })
            }
        }
    }
});

//debug('background.js - loaded')