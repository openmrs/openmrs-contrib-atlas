var page = require('webpage').create(),
system = require('system'),
address, output, size, queue, legend, zoom, lng, lat;

queue = [];
address = 'http://107.170.156.44/'
output = 'maptest.png'
selector = '#map_canvas';
page.viewportSize = { width: 1280, height: 720 };

if (system.args.length < 1 ) {
    console.log('Missing output arg');
} else {
    output = system.args[1];
    legend = system.args[2];
    zoom = system.args[3];
    lat = system.args[4];
    lng = system.args[5];
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
    phantom.exit(1);
};

page.onResourceRequested = function(req, net){
    console.log('Request (#' + req.id + ') URL:'+ req.url);
    if (req.url ==='https://id.openmrs.org/globalnav/js/app-optimized.js')
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
                console.log("Beautify atlas...");
                page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js", function() {
                    page.evaluate(function() {
                      if (!JSON.stringify && typeof JSON.serialize === "function") {
                        JSON.stringify = JSON.serialize;
                      }
                      if (!JSON.parse && typeof JSON.deserialize === "function") {
                        JSON.parse = JSON.deserialize;
                      }
                    });
                    page.evaluate(function(param) {
                        var clickElement = function (el){
                            var ev = document.createEvent("MouseEvent");
                            ev.initMouseEvent(
                              "click",
                              true /* bubble */, true /* cancelable */,
                              window, null,
                              0, 0, 0, 0, /* coordinates */
                              false, false, false, false, /* modifier keys */
                              0 /*left*/, null
                            );
                            el.dispatchEvent(ev);
                        };

                        $(".control").attr('hidden', 'true');
                        $(".gmnoprint").attr('hidden', 'true');
                        $("#legend").removeAttr('hidden');
                        if (param.legend == "2")
                            clickElement($("#legend1")[0]);
                        if (param.legend == "1")
                            clickElement($("#legend2")[0]);
                        //map.setZoom(8);
                    }, { legend: legend, zoom: zoom, lat: lat, lng: lng });

                    setTimeout(function () {
                        console.log("Rendering to file...");
                        page.render(output);
                        queue[address] = 'done';
                        console.log("Succes !");
                        phantom.exit();
                    }, 20000);
               });
            }
        },8000);                 
    }
});