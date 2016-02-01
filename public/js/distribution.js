function getAJAXCallForDistributions(){
    return $.ajax({
            url: "distributions",
            type: "GET"
        })
        .done(function (response) {
            distributions = response;
        })
        .fail(function (jqXHR) {
            bootbox.alert("Error fetching distribution list" + jqXHR.statusText);
        })
}

function getDistributionId(distributionName) {
    var distributionId = null;
    distributions.forEach(function (distribution) {
        if (distribution.name === distributionName) {
            distributionId = distribution.id;
            return false;
        }
    });
    return distributionId;
}

function getDistributionsAndUpdateInfoWindow(site, infowindow) {
        getAJAXCallForDistributions()
            .done(function (response) {
                distributions = response;
                site.distribution = getDistributionId(site.nonStandardDistributionName);
            })
            .always(function () {
                infowindow.setContent(contentInfowindow(site));
            })
}

function manageOtherDistribution(element){
    var index =  element.selectedIndex;
    var selectedText = element.options[index].text.toLowerCase();

    selectedText === 'other' ?
        $('#nonStandardDistributionNameContainer').slideDown(50):
        $('#nonStandardDistributionNameContainer').slideUp(50);
    $('#nonStandardDistributionName').removeAttr('value');
};

function createOptionsForDistributionSelectBox(siteDistributionId, attributes) {
    var selectionForOther = '';

    var html = "<option selected disabled> -- Select Distribution -- </option>";

    distributions.forEach(function (distribution){
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

    html += "<option value='other' "+ selectionForOther + ">Other</option>";

    return html;
};

function createNonStandardDistributionInput(nonStandardDistribution) {

    var html = "<div class='form-group " + nonStandardDistribution.containerClass + "' id='nonStandardDistributionNameContainer'>";
    html += "<input type='text' id='nonStandardDistributionName' placeholder='Enter distribution name' class='form-control input-sm' value='" + nonStandardDistribution.name + "'></div>";
    return html;
};

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
};
