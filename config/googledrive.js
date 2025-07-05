const {google}=require('googleapis')

const getGoogleDriveAuth=()=>{
    const auth=new google.auth.GoogleAuth({
        credentials:{
            client_email:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return auth;
}
module.exports={
    getGoogleDriveAuth
}