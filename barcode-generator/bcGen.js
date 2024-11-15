// CLIENT-SIDE BARCODE GENERATOR



// unique barcode symb, val, and svg stored in objects in a Set
const uniqueBarcodes = new Set();     
window.uniqueBarcodes = uniqueBarcodes;

document.addEventListener('DOMContentLoaded', function(e){
    // load barcodes when page initially loads
    reloadBarcodes();
});





// to be used when page initially loads and any other times barcodes may need to be reloaded
window.reloadBarcodes = reloadBarcodes;
function reloadBarcodes() {
    const barcodeNodes = document.querySelectorAll('.jsBarcode:not(.jsBarcode-rendered)');     

    // add each symb and val from barcode source nodes to the uniqueBarcodes Set
    barcodeNodes.forEach(node => {                                  
        const symb = node.getAttribute('symb');                       
        const val = node.getAttribute('val');

        // only add if it doesn't exist yet
        if(symb && val) {                                           
            if (!symbValPairExists(symb, val)) {
                uniqueBarcodes.add(JSON.stringify({symb: symb, val: val, rendered: null}));
            }
        }
    });

    
    // process each barcode in the Set (convert to JSON objects in array to do so)
    const barcodeArray = Array.from(uniqueBarcodes).map(barcode => JSON.parse(barcode));
    const generationPromises = barcodeArray.map(barcode => {
        if (barcode.rendered === null) {
            return generateBarcode(barcode);
        } else {
            return Promise.resolve();
        }
    });

    // apply rendered SVGs 
    Promise.all(generationPromises)
    .then(() => {
        barcodeArray.forEach(barcode => {
            const targetNodes = document.querySelectorAll('.jsBarcode:not(.jsBarcode-rendered)[symb="'+ barcode.symb +'"][val="'+ barcode.val +'"]');
            targetNodes.forEach(target => {
                target.innerHTML = barcode.rendered;
                target.classList.add('jsBarcode-rendered');
            });
        });
    })
    .then(() => {
        const event = new CustomEvent('jsBarcodesReloaded');
        document.dispatchEvent(event);
    })
    .catch(error => {
        console.error('Error: Unable to reload barcodes', error);
    });
}





function symbValPairExists (aSymb, aVal) {
    for (aBarcode of uniqueBarcodes) {
        const codeObject = JSON.parse(aBarcode);
        if (codeObject.symb === aSymb && codeObject.val === aVal) return true;
    }
    return false;   // default state
}





function generateBarcode(barcode) { // generate an svg barcode from symbology and value 
    let symbology = barcode.symb; let value = barcode.val.toString();
    
    // only numeric values are currently supported; only C128C, UPCA, and EAN-13 are currently supported
    if (Number.isNaN(Number(value))) {storeBarcode(barcode, 'NaN'); return;} 
    if (!['C128','C128A','C128B','C128C', 'EAN', 'EAN13', 'EAN-13', 'UPC', 'UPCA', 'UPC-A'].includes(barcode.symb.toUpperCase())) {storeBarcode(barcode, 'Invalid Symb'); return;}


    // assign correct symbology
    if (['C128','C128A','C128B','C128C'].includes(barcode.symb.toUpperCase())) {
        symbology = 'C128'
    } else if (['EAN','EAN13','EAN-13'].includes(barcode.symb.toUpperCase())) {
        symbology = 'EAN13'
    } else if (['UPC','UPCA','UPC-A'].includes(barcode.symb.toUpperCase())) {
        symbology = (value.length === 12) ? 'UPC' : 'EAN13';
    } else {symbology = symbology.toUpperCase();}


    // convert UPC to EAN13 ... UPC-A is a subset of EAN13 where the first digit is 0
    if (symbology === 'UPC') {
        value = '0' + value;
        symbology = 'EAN13';
    }


    // store and return barcode svg
    if (symbology === 'C128') {                                             // generate c128c barcode (c128a/c128b/code-39 barcodes aren't supported)
        return renderC128C(value).then(svg => {storeBarcode(barcode, svg);});
    } else if (symbology === 'EAN13') {
        return renderEAN13(value).then(svg => {storeBarcode(barcode, svg);});
    }
}





function renderC128C(value) {
    let renderedSVG; let svgWidth = 0; // the complete svg, physical width of svg; calculated width of previous bar
    let previousWidth; let calcWidth; let fillColor;                // previous bar width; previous calculated width because each rect is longer than width; rectangle fill color
    const startCode = '211232'; const stopCode = '2331112';                     // start and stop widths. Same stop code for c128a/b/c, start code is 211412 for a, 211214 for b, 211232 for c

    return fetchJSON('/js/barcode-generator/data_barcodeC128C.json')
    .then(data => {
        // use the data and passed in value to render the barcode
        let iteration = 0; let cursorPosition;
        let widths = '';                            // widths for barcode values (black/white widths)

        let checkSumValue = 105;                    // used to check the value from a single set of 6 widths; total checksum value before converting to widths ... 103 for c128c, 104 for c128b, 105 for c128c
        let checkSumWidths = '';                    // widths for barcode last value (checksum, black/white widths)


        // generate barcode line widths
        while (iteration < value.toString().length) {
            cursorPosition = iteration + 1;
            const aNumber = Number(value.substring(cursorPosition - 1, cursorPosition + 1));

            const lookup = data.find(item => Number(item.outputC) === aNumber)                      // lookup in table via two digit output value
            const width = lookup ? lookup.widths : '';
            widths = widths + width;                                                                // append widths to existing widths

            checkSumValue = checkSumValue + (aNumber * ((iteration / 2) + 1));                      // check sum is sum of values multiplied by their position in barcode                      // add current value to checksum
            iteration += 2;                                                                         // iterate by 2 to check two digits at a time
        }

        checkSumValue = checkSumValue % 103;                                                        // final modulus calc for checkSum
        lookup = data.find(item => Number(item.outputC) === checkSumValue);                         // get checksum widths
        checkSumWidths = lookup ? lookup.widths : '';

        widths = startCode + widths + checkSumWidths + stopCode;                                    // complete set of widths for the barcode!
        for (let i = 0; i < widths.length; i++) {svgWidth += Number(widths[i])}                     // get the physical width of the svg


        // convert the widths into SVG rectangles
        let rectangles = ``;
        const widthsArray = widths.split('').map(Number);
        widthsArray.map((width, index) => {
            calcWidth = (index === 0) ? svgWidth : calcWidth - previousWidth;
            fillColor = (isOdd(index)) ? 'rgb(255,255,255)' : 'rgb(0,0,0)';
            previousWidth = width;
            rectangles += `<rect width="${calcWidth + 4}px" height="23px" style="fill:${fillColor};"/>`;
        }).join('\n');


        renderedSVG =
        `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:${svgWidth + 8}px; height:23px;" viewbox="0 0 ${svgWidth + 8} 23">
            <rect width="${svgWidth + 8}px" height="23px" style="fill:rgb(255,255,255);"/>
            ${rectangles}
            <rect width="4px" height="23px" style="fill:rgb(255,255,255);"/>
            Please upgrade to a browser that supports svg images in order to view this barcode.
        </svg>
        `; return renderedSVG;
    })
    .catch (error => {
        console.error('Error rendering c128c barcode', error);
        return 'render err';
    });
}





function renderEAN13(value) {
    let renderedSVG; const startCode = '111'; const midGuard = '11111'; let svgWidth = 0;   // the complete svg, start/stop widths (same), physical width of svg; calculated width of previous bar
    let previousWidth; let calcWidth; let fillColor; let height;                            // previous bar width; previous calculated width because each rect is longer than width; rectangle fill color; height of rectangle

    return fetchJSON('/js/barcode-generator/data_barcodeEAN13.json')
    .then(data => {
        if(value.length === 13) value = value.substring(0,12);              // remove checksum for recalculation
        let iteration = 0; let cursorPos = 0; let structPos = 0;            // cursorPos is 1 ahead of structPos because first char (ie 0) defines structure and is encoded via the structure of the EAN13 code
        let widths = ''; let width = ''; let checkSumWidths = '';           // widths for barcode values (black/white widths)
        let structure = '';
        let oddChecksum = 0; let evenChecksum = 0; let finalChecksum = 0;   // checksum containers

        if      (Number(value.substring(0,1)) === 0) structure = 'LLLLLL'   // UPC-A
        else if (Number(value.substring(0,1)) === 1) structure = 'LLGLGG'
        else if (Number(value.substring(0,1)) === 2) structure = 'LLGGLG'
        else if (Number(value.substring(0,1)) === 3) structure = 'LLGGGL'
        else if (Number(value.substring(0,1)) === 4) structure = 'LGLLGG'
        else if (Number(value.substring(0,1)) === 5) structure = 'LGGLLG'
        else if (Number(value.substring(0,1)) === 6) structure = 'LGGGLL'
        else if (Number(value.substring(0,1)) === 7) structure = 'LGLGLG'
        else if (Number(value.substring(0,1)) === 8) structure = 'LGLGGL'
        else if (Number(value.substring(0,1)) === 9) structure = 'LGGLGL'

        // first character is encoded using the structure rule above.
        // six characters on left side differ in widths value depending if the position is an L or a G.
        // five characters on the right side always follow the same widths rule regardless of position.
        // the sixth character on the right is added on later as a checksum.
        // total, 13 chars: 1 structure code, 6 left, 5 right, 1 checsksum

        
        // left half of the code
        while (iteration <= 5) {
            const aNumber = Number(value.substring(cursorPos, cursorPos + 1));

            if (iteration > 0){                                                                 // first char is encoded via structure, not widths/bars!
                if (structure.substring(structPos - 1, structPos) === 'L') {                    // if L
                    const lookup = data.find(item => Number(item.outputValue) === aNumber)      // lookup in table
                    width = lookup ? lookup.widthsLR : '';
                } else if (structure.substring(structPos  - 1, structPos) === 'G') {            // if G
                    const lookup = data.find(item => Number(item.outputValue) === aNumber)      // lookup in table
                    width = lookup ? lookup.widthsG : '';
                }; widths = widths + width;                                                     // append
            }

            if (isOdd(cursorPos + 1))  {oddChecksum += aNumber}                                 //checkSUM
            if (isEven(cursorPos + 1)) {evenChecksum += aNumber}

            iteration += 1; structPos = iteration;                                              // structPos happens to be the same as iteration
            cursorPos += 1;
        }

        
        // right half of the code ... essentially works the same as left half but always uses if LR and never if G
        while (iteration > 5 && iteration <= 11) {
            const aNumber = Number(value.substring(cursorPos, cursorPos + 1));

            const lookup = data.find(item => Number(item.outputValue) === aNumber)                // lookup in table
            width = lookup ? lookup.widthsLR : '';
            widths = widths + width;

            if (isOdd(cursorPos + 1))  {oddChecksum += aNumber}     
            if (isEven(cursorPos + 1)) {evenChecksum += aNumber}

            iteration += 1;
            cursorPos += 1;
        }
        

        // finalize checksum
        evenChecksum = evenChecksum * 3;
        finalChecksum = evenChecksum + oddChecksum;
        finalChecksum = ((Math.floor(finalChecksum / 10) + 1) * 10) - finalChecksum;
        if (finalChecksum === 10) finalChecksum = 0;

        const lookup = data.find(item => Number(item.outputValue) === finalChecksum)              // lookup in table
        checkSumWidths = lookup ? lookup.widthsLR : '';
        widths = widths + checkSumWidths;

        // complete set of widths for the barcode! ... stopCode is same as startCode
        widths = startCode + widths.substring(0,24) + midGuard + widths.substring(24,49) + startCode;                                    
        for (let i = 0; i < widths.length; i++) {svgWidth += Number(widths[i])}                 // get the physical width of the svg


        // convert the widths into SVG rectangles
        let rectangles = ``;
        const widthsArray = widths.split('').map(Number);
        widthsArray.map((width, index) => {
            calcWidth = (index === 0) ? svgWidth : calcWidth - previousWidth;
            fillColor = (isOdd(index)) ? 'rgb(255,255,255)' : 'rgb(0,0,0)';
            height = (index < 3 || index > 54 || (index > 27 && index < 31) || isOdd(index)) ? 42 : 37;
            previousWidth = width;
            rectangles += `<rect width="${calcWidth + 8}px" height="37px" style="fill:${fillColor}; height:${height}px;"/>`;
        }).join('\n');


        renderedSVG =
        `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:${svgWidth + 16}px; height:50.25px;" viewbox="0 0 ${svgWidth + 16} 50.25">
        <rect width="${svgWidth + 16}px" height="50.25px" style="fill:rgb(255,255,255);"/>
        ${rectangles}
        <rect width="8px" height="37px" style="fill:rgb(255,255,255); height:42px;"/>
        <text xml:space="preserve" font-size="9.5pt" x="0" y="50" fill="black">${value.substring(0,1)}&nbsp;&nbsp;&nbsp;${value.substring(1,7)}&nbsp;&nbsp;${value.substring(7,12)}${finalChecksum}</text>
        Please upgrade to a browser that supports svg images in order to view this barcode.
        `; return renderedSVG;
    })
    .catch (error => {
        console.error('Error rendering EAN13 barcode', error);
        return 'render err';
    });
}





function fetchJSON (filePath) {
    return fetch(filePath, {cache: 'default'})
    .then(response => {
        if (!response.ok) {
            throw new Error ('Unable to retrieve JSON file, ', filePath, ' from server');
        }
        return response.json();
    });
}





function storeBarcode(barcode, renderedSVG){
    // update the value in the uniqueBarcodes Set (long term storage location, the barcode.rendered value is the temp value in the processing array)
    barcode.rendered = renderedSVG;

    if (uniqueBarcodes.has(JSON.stringify({symb: barcode.symb, val: barcode.val, rendered: null}))) {
        uniqueBarcodes.delete(JSON.stringify({symb: barcode.symb, val: barcode.val, rendered: null}));
        uniqueBarcodes.add(JSON.stringify({symb: barcode.symb, val: barcode.val, rendered: renderedSVG}));
    }
}
