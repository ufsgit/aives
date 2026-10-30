// declare global {
//   interface Window {
//     __env?: {
//       BasePath?: string;
//       AWS_ACCESS_KEY_ID?: string;
//       AWS_SECRET_ACCESS_KEY?: string;
//       AWS_REGION?: string;
//       AWS_S3_BUCKET?: string;
//     };
//   }
// }

// const runtimeEnv = window.__env || {};

// const isLocalhost = typeof window !== 'undefined' && 
//   (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// export const environment = {
//   BasePath: runtimeEnv.BasePath || (isLocalhost ? 'http://localhost:3520/' : 'https://aiveseduapi.ufstech.co.in/'),
//   FilePath: 'https://ufsnabeelphotoalbum.s3.us-east-2.amazonaws.com/',
//   s3Path: 'https://ufsnabeelphotoalbum.s3.amazonaws.com/',
//   awsAccessKeyId: runtimeEnv.AWS_ACCESS_KEY_ID || '',
//   awsSecretAccessKey: runtimeEnv.AWS_SECRET_ACCESS_KEY || '',
//   awsRegion: runtimeEnv.AWS_REGION || 'us-east-2',
//   awsS3Bucket: runtimeEnv.AWS_S3_BUCKET || 'ufsnabeelphotoalbum',
// };

declare global {
  interface Window {
    __env?: {
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      AWS_REGION?: string;
      AWS_S3_BUCKET?: string;
    };
  }
}
// 
const runtimeEnv = window.__env || {};

export const environment = {
  //  BasePath:"http://localhost:4200/",
  BasePath:"http://localhost:3520/",
  // BasePath: "https://aiveseduapi.ufstech.co.in/",

  // BasePath:"https://lmsdemoapi.ufstech.co.in/",

  // BasePath:"https://brooksschool.ufstech.co.in/",

  //  BasePath:"https://igmapi.ufstech.co.in/",
  FilePath: 'https://ufsnabeelphotoalbum.s3.us-east-2.amazonaws.com/',
  s3Path: 'https://ufsnabeelphotoalbum.s3.amazonaws.com/',
  awsAccessKeyId: runtimeEnv.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: runtimeEnv.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: runtimeEnv.AWS_REGION || 'us-east-2',
  awsS3Bucket: runtimeEnv.AWS_S3_BUCKET || 'ufsnabeelphotoalbum',
};
