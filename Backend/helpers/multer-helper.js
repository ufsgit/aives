/***
 * Multer helper 
 * Import this module to router to use
 */
const multer = require('multer');
const uuidv1 = require('uuid/v1');

const storage = multer.diskStorage(
    {
  
      destination: function (req, file, cb) {
        cb(null, 'Uploads')
      },
      filename: function (req, file, cb) {
        
        let Extension_Temp = '';
        //if (req.body.Photo) {
if(file!=undefined)
{
          Extension_Temp = file.originalname.indexOf(".");
          Extension_Temp = file.originalname.substring(Extension_Temp, file.originalname.length);
        }
        cb(null, uuidv1() + Extension_Temp);
      }
    }
  )
  var upload = multer({ storage: storage });
  module.exports=upload;