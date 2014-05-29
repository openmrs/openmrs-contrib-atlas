var page = require('webpage').create(),
system = require('system'),
address, output, size, queue;

queue = [];
address = 'http://localhost/openmrs-contrib-atlas/public/'
output = 'maptest.png'
selector = '#map_canvas';
page.viewportSize = { width: 1280, height: 720 };

if (system.args.length < 1 ) {
    console.log('Missing output arg');
} else {
    output = system.args[1];
    console.log('Output: ' + output);
}

page.onError = function(msg, trace) {
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
        });
    }
    console.error(msgStack.join('\n'));
};

page.onResourceRequested = function(req, net){
    console.log('Request (#' + req.id + ') URL:'+ req.url);
    if (req.url === 'https://id.openmrs.org/globalnav')
        net.abort();
}
page.onResourceReceveid = function(req, net){
    console.log("onResourceReceveid" + req.url);
}

page.open(address, function (status) {
    if (status !== 'success') {
        console.log('Unable to load the address!');
    } else {
        queue[address] = 'queued'
        window.setTimeout(function () {
            console.log("Getting Map Canvas");
            if (queue[address] !== 'done') {
                console.log("Page loading succesfull");
                var clipRect = page.evaluate(function (s) {
                var cr = document.querySelector(s).getBoundingClientRect();
                    return cr;
                }, selector);
                page.clipRect = {
                    top: clipRect.top,
                    left: clipRect.left,
                    width: clipRect.width,
                    height: clipRect.height
                };
                console.log("Beautify atlas...");
                page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js", function() {
                    page.evaluate(function() {
                        $(".control").attr('hidden', 'true');
                        $(".gmnoprint").attr('hidden', 'true');
                        $("#legend").removeAttr('hidden');
                    });
                    console.log("Rendering to file...");
                    page.render(output);
                    queue[address] = 'done';
                    console.log("Succes !");
                    phantom.exit();
               });
            }
        },8000);                 
    }
});
