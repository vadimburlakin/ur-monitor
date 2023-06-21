# About this project
This project notifies you about vacant properties in UR. It is built with JavaScript, uses Serverless framework and deploys to AWS. It is based on an official example of cron-like application from Serverless (https://www.serverless.com/examples/aws-node-scheduled-cron). It runs and deploys exactly like the documentation describes, with just a couple thigs added on top.

The tool notifies you about any newly opened properties in a defined area. You are only notified if a property was full before and became vacant.

Before you deploy it, you need to configure this tool to search for properties you're interested in. The tool notifies you about any newly opened properties in a defined area (defined as longtitude/latitude polygon). You are only notified in case if a property within the defined area that was not available became vacant. The configuration is very basic: you only define the search area. You can't filter by room type, price or anything else. 

The workflow is as follows:
1. Define the search area in a form of longtitude/latitude polygon (configured in `index.js`).
2. Tweak the XHR request in `index.js` that queries UR for open properties. The reason we need to tweak it is because the XHR request URL includes the search conditions, including the property location. You can probably modify the script to grab location from step #1, but the easiest way is to just open the UR website, navigate to location you're looking properties in, dial in all the search conditions, look up XHR URL in the inspector and paste it here: https://github.com/vadimburlakin/ur-monitor/blob/main/index.js#LL89C1-L89C1
3. Define how often do you want to check in to see if anything opened up. Default is 5 minutes. Defined in `serverless.yml`.
4. Every time the app runs, it checks in with UR website and compares the current state with the state of the previous time it ran. The previous state is stored in an S3 bucket as a JSON file. S3 bucket is defined in `serverless.yml` and will be created automatically.
5. If it identifies that a property that used to be full previously now has rooms available, it sends you a generic alert via email using Simple Email Service.
6. You receive the alert and check UR website. If the property that's opened is interesting, you give UR a call right away.

How to configure:
1. Define the search polygon in `index.js`
2. Define `UR_PROPERTY_MONITOR_NOTIFICATIONS_EMAIL_LIST` in AWS Systems Manager Parameters Store. Set it to your email address (where notifications would be sent).
3. Define `UR_PROPERTY_MONITOR_NOTIFICATIONS_SENDER_EMAIL` in AWS Systems Manager Parameters Store. This is the email address where emails will be sent from.
4. I think you also need to configure something in the AWS Simple Email Service to allow sending emails from/to above addresses. You probably need to validate these addresses before you use SES. Sorry, I forgot the exact steps.

Below is the leftovers of the original readme of Serverless cron app that you can refer to for deploying and configuring.

# Serverless Framework Node Scheduled Cron on AWS

This template demonstrates how to develop and deploy a simple cron-like service running on AWS Lambda using the traditional Serverless Framework.

## Schedule event type

This examples defines two functions, `cron` and `secondCron`, both of which are triggered by an event of `schedule` type, which is used for configuring functions to be executed at specific time or in specific intervals. For detailed information about `schedule` event, please refer to corresponding section of Serverless [docs](https://serverless.com/framework/docs/providers/aws/events/schedule/).

When defining `schedule` events, we need to use `rate` or `cron` expression syntax.

### Rate expressions syntax

```pseudo
rate(value unit)
```

`value` - A positive number

`unit` - The unit of time. ( minute | minutes | hour | hours | day | days )

In below example, we use `rate` syntax to define `schedule` event that will trigger our `rateHandler` function every minute

```yml
functions:
  rateHandler:
    handler: handler.run
    events:
      - schedule: rate(1 minute)
```

Detailed information about rate expressions is available in official [AWS docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#RateExpressions).


### Cron expressions syntax

```pseudo
cron(Minutes Hours Day-of-month Month Day-of-week Year)
```

All fields are required and time zone is UTC only.

| Field         | Values         | Wildcards     |
| ------------- |:--------------:|:-------------:|
| Minutes       | 0-59           | , - * /       |
| Hours         | 0-23           | , - * /       |
| Day-of-month  | 1-31           | , - * ? / L W |
| Month         | 1-12 or JAN-DEC| , - * /       |
| Day-of-week   | 1-7 or SUN-SAT | , - * ? / L # |
| Year          | 192199      | , - * /       |

In below example, we use `cron` syntax to define `schedule` event that will trigger our `cronHandler` function every second minute every Monday through Friday

```yml
functions:
  cronHandler:
    handler: handler.run
    events:
      - schedule: cron(0/2 * ? * MON-FRI *)
```

Detailed information about cron expressions in available in official [AWS docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#CronExpressions).


## Usage

### Deployment

This example is made to work with the Serverless Framework dashboard, which includes advanced features such as CI/CD, monitoring, metrics, etc.

In order to deploy with dashboard, you need to first login with:

```
serverless login
```

and then perform deployment with:

```
serverless deploy
```

After running deploy, you should see output similar to:

```bash
Deploying aws-node-scheduled-cron-project to stage dev (us-east-1)

✔ Service deployed to stack aws-node-scheduled-cron-project-dev (205s)

functions:
  rateHandler: aws-node-scheduled-cron-project-dev-rateHandler (2.9 kB)
  cronHandler: aws-node-scheduled-cron-project-dev-cronHandler (2.9 kB)
```

There is no additional step required. Your defined schedules becomes active right away after deployment.

### Local invocation

In order to test out your functions locally, you can invoke them with the following command:

```
serverless invoke local --function rateHandler
```

After invocation, you should see output similar to:

```bash
Your cron function "aws-node-scheduled-cron-dev-rateHandler" ran at Fri Mar 05 2021 15:14:39 GMT+0100 (Central European Standard Time)
```
