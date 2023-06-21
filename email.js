const {
  SESClient,
  SendEmailCommand
} = require("@aws-sdk/client-ses");

module.exports.sendEmail = async function sendEmail(from, to, subject, body) {
  const ses = new SESClient({ region: process.env.AWS_REGION });
  const params = {
    Source: from,
    Destination: {
      ToAddresses: to,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'utf-8',
      },
      Body: {
        Html: {
          Data: `
          <html>
          <head>
          </head>
          <body>
           ${body}
          </body>
          </html>
            `,
          Charset: 'UTF-8',
        },
      },
    },
  };
  const sendEmailCommand = new SendEmailCommand(params);
  await ses.send(sendEmailCommand);
};
