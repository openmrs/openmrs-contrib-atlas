var getCachedDistributions = null;

function makeAJAXCallForDistributions(){

    return $.ajax({
            url: "distributions",
            type: "GET"
        })
        .done(function (distributions) {
            getCachedDistributions = (function(){
                return function(){ return distributions};
            })();
        })
        .fail(function (jqXHR) {
            bootbox.alert("Error fetching distribution list" + jqXHR.statusText);
        })
}

function getDistributionInfo(distributionId) {
    var html = '';
    getCachedDistributions().forEach(function (distribution) {
        if (distribution.id == distributionId) {
            html = "<div><span class='site-label'>Distribution:</span> " + distribution.name + "</div>";
            return false;
        }
    });
    return html;
}

function getDistributionId(distributionName) {
    var distributionId = null;
    getCachedDistributions().forEach(function (distribution) {
        if (distribution.name === distributionName) {
            distributionId = distribution.id;
            return false;
        }
    });
    return distributionId;
}

function getDistributionsAndUpdateInfoWindow(site, infowindow) {
        makeAJAXCallForDistributions()
            .done(function (response) {
                site.distribution = getDistributionId(site.nonStandardDistributionName);
            })
            .always(function () {
                infowindow.setContent(contentInfowindow(site));
            })
}

function manageOtherDistribution(element){
    var index =  element.selectedIndex;
    var selectedText = element.options[index].text.toLowerCase();

    selectedText === constants.OTHER.value ?
        $('#nonStandardDistributionNameContainer').slideDown(constants.SLIDE_TIME_IN_MILLIS):
        $('#nonStandardDistributionNameContainer').slideUp(constants.SLIDE_TIME_IN_MILLIS);
        $('#nonStandardDistributionName').removeAttr('value');
};

function createOptionsForDistributionSelectBox(siteDistributionId, attributes) {
    var selectionForOther = '';

    var html = "<option selected disabled> -- Select Distribution -- </option>";

    getCachedDistributions().forEach(function (distribution){
        if(distribution.is_standard ){
            var selected = siteDistributionId == distribution.id ? "selected" : "";
            html += "<option " + selected + " value =" + distribution.id + ">" + distribution.name + "</option>";
        }

        if(!siteDistributionId && attributes.name != ""){
            selectionForOther = "selected";
            attributes.containerClass = "";
        }

        if(!distribution.is_standard && distribution.id == siteDistributionId){
            selectionForOther = "selected";
            attributes.name = distribution.name;
            attributes.containerClass = "";
        }
    });

    html += "<option value='"+constants.OTHER.value+"' "+ selectionForOther + ">"+constants.OTHER.displayName+"</option>";

    return html;
}

function createNonStandardDistributionInput(nonStandardDistribution) {

    var html = "<div class='form-group " + nonStandardDistribution.containerClass + "' id='nonStandardDistributionNameContainer'>";
    html += "<input type='text' id='nonStandardDistributionName' placeholder='Enter distribution name' class='form-control input-sm' value='" + nonStandardDistribution.name + "'></div>";
    return html;
}

function createDistributionSelectBox(siteDistributionId, nonStandardDistributionName) {

    var nonStandardDistribution ={
        containerClass : "soft-hidden",
        name : nonStandardDistributionName || ""
    };

    var html = "<div class='form-group'>";
    html += "<select title='Distribution' id='distributions' class='form-control input-sm' onchange='manageOtherDistribution(this)'>";
    html += createOptionsForDistributionSelectBox(siteDistributionId, nonStandardDistribution);
    html += "</select></div>";
    html += createNonStandardDistributionInput(nonStandardDistribution);

    return html;
}

function getSelectedDistributionValue() {
    return $("select#distributions").val() == constants.OTHER.value ? null : $("select#distributions").val();
}
