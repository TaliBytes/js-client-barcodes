# Javascript Client-Side Barcode Generator

## Introduction

A simple client-side barcode generator built using JavaScript to transform specific HTML elements into barcodes. How it works:

1. The server generates classed divs with symbology and value attributes (or these can be manually placed in a static file)
2. Upon page load, a JS Script captures each unique symbology and value (ie, the same symb/val pair could exist multiple times, but the script only captures it once)
3. Each symbology and value pair is converted into a barcode and stored in a global object.
4. The script find every barcode div on the page and populates it with the stored symb/val pair.

The above methodology is used to ensure each unique barcode is rendered only one time, but displayed as many times as necessary. This significantly reduces load on the client and allows for fast "rendering."

### Formats

Barcodes come in many formats. This tool supports EAN-13, UPC-A (a subset of EAN-13), and C128 (A, B, and C, defaulting to C).

## To Use

Place the barcode-generator/ directory into your project. Include the js script in the HTML head element.

```HTML
<script src="/barcode-generator/bcGen.js"></script>
```

Place a div anywhere a barcode should render. Additional class names and IDs are okay. Replace `@symb` with the symbology and `@val` with the value that should be encoded into the barcode.

Valid symbology names are C128, C128A, C128B, C128C, EAN, EAN13, EAN-13, UPC, UPCA, UPC-A. Note, this is *not* case sensitive.

```HTML
<div class="jsBarcode" symb="@symb" val="@val">&nbsp;</div>
```

When the page loads, the `reloadBarcodes()` function is automatically called. This begins the process described in "Introduction." `reloadBarcodes()` can be called later to manually refresh barcodes as well; for example, if the server adds additional barcodes to the page or updates the value of an existing barcode, `reloadBarcodes()` should be called to render the new barcodes.
