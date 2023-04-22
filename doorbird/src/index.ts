import * as functions from "firebase-functions";

const secretKeys = [
  "TWILIO_API_KEY",
  "DOORBIRD_BASIC_AUTH"
] as const;
type Secrets = Record<(typeof secretKeys)[number], string>;

export const doorbird__twilio = functions
  .runWith({ secrets: [...secretKeys] })
  .https.onRequest(async (request, response) => {
    // @ts-ignore
    const secrets = process.env as Secrets;

    response.status(200).end();
  });
