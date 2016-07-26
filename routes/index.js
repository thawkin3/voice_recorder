var express = require('express');
var router = express.Router();
var multer  = require('multer');

// Save the files in the uploads directory
// var upload = multer({ 
// 	dest: 'uploads/',
// 	limits: { fileSize: 16000000 },
// 	fileFilter: function (req, file, cb) {
// 		var acceptableMimeTypes = ['audio/wav', 'audio/x-wav'];
// 		if (acceptableMimeTypes.indexOf(file.mimetype) == -1) {
// 			req.fileValidationError = 'Sorry, this file type is not allowed for upload';
// 			return cb(null, false, new Error('Sorry, this file type is not allowed for upload'));
// 		} else {
// 			cb(null, true);
// 		}
// 	}
// });

// OR
// Save the files with no limits or validation requirements
var upload = multer({ dest: 'uploads/' });

// OR
// Don't save the files anywhere
// var upload = multer({});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile('index.html', { root:  'public' });
});


/* GET page that shows file size */
router.post('/uploadAudio', upload.single('file'), function(req, res, next) {
  	console.log(req.file);
  	if(req.fileValidationError) {
        return res.status(500).send(req.fileValidationError);
    }

  	var jsonResult = {
  		size: req.file.size,
  		originalFileName: req.file.originalname,
  		newFilename: req.file.filename,
  		mimetype: req.file.mimetype
  	};
	res.status(200).json(jsonResult);

});

module.exports = router;
