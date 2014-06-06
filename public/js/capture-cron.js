var page = require('webpage').create(),
system = require('system'),
address, output, size, queue, legend, width, height, fade;

queue = [];

if (system.args.length < 1 ) {
    console.log('Missing output arg');
} else {
    path = system.args[1];
    legend = system.args[2];
    width = system.args[3];
    height = system.args[4];
    address = (system.args[5]);
    fade = (system.args[6]);
    console.log('Param:' + path +  "/" + legend + "/" + address);
}

page.viewportSize = { width: width, height: height };
output = path + '/atlas' + legend + fade + '_' + width + 'x'+ height +'.png';
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
    if (req.url ==='https://id.openmrs.org/globalnav/js/app-optimized.js')
      net.abort();
}
page.onResourceReceveid = function(req, net){

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
                    if (param.fade == "0")
                        clickElement($("#fadeCheckbox")[0]);
                    if (param.legend == "2")
                        clickElement($("#legend1")[0]);
                    if (param.legend == "1")
                        clickElement($("#legend2")[0]);
                }, { legend: legend , fade: fade});

                setTimeout(function () {
                    console.log("Rendering to file...");
                    page.render(output);
                    queue[address] = 'done';
                    console.log("Succes !");
                    phantom.exit();
                }, 20000);
            }
        },20000);                 
    }
});