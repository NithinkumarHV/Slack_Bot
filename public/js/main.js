var domtoimage = require("dom-to-image");
var fileSaver = require("file-saver");
var node = document.getElementById("my-node");
var btn = document.getElementById("foo");

btn.onclick = function () {
  console.log("hello");
  domtoimage.toBlob(document.getElementById("my-node")).then(function (blob) {
    fileSaver.saveAs(blob, "QRcode.png");
  });
};
