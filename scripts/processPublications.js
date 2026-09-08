import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const messaging = getMessaging();

function formatPublicationPeriod(type) {
  switch (type) {
    case "this-week":
      return "this week";

    case "next-week":
      return "next week";

    case "next-2-weeks":
      return "the next 2 weeks";

    case "this-month":
      return "this month";

    default:
      return "the selected period";
  }
}

async function getEmployeeTokens() {
  const usersSnapshot = await db.collection("users").get();

  const tokens = [];

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();

    if (userData.role !== "employee") {
      continue;
    }

    const tokenSnapshot = await userDoc.ref
      .collection("pushTokens")
      .get();

    tokenSnapshot.forEach((tokenDoc) => {
      const tokenData = tokenDoc.data();

      if (tokenData.token) {
        tokens.push({
          token: tokenData.token,
          userID: userDoc.id,
          tokenID: tokenDoc.id
        });
      }
    });
  }

  return tokens;
}

async function processPublications() {
  try {
    const publicationsSnapshot = await db
      .collection("publications")
      .get();

    const newPublications = publicationsSnapshot.docs.filter(
      (publicationDoc) => {
        const data = publicationDoc.data();

        return !data.pushSentAt;
      }
    );

    if (newPublications.length === 0) {
      console.log("No new publications to process.");
      return;
    }

    console.log(
      `Found ${newPublications.length} publication(s) to process.`
    );

    const employeeTokens = await getEmployeeTokens();

    if (employeeTokens.length === 0) {
      console.log("No employee push tokens found.");
      return;
    }

    console.log(
      `Found ${employeeTokens.length} employee device(s).`
    );

    for (const publicationDoc of newPublications) {
      const publication = publicationDoc.data();

      const periodText = formatPublicationPeriod(
        publication.type
      );

      const response = await messaging.sendEachForMulticast({
        tokens: employeeTokens.map((item) => item.token),

        notification: {
          title: "Timetable Published",
          body: `The timetable for ${periodText} is now available.`
        },

        data: {
          type: "timetable_published",
          publicationID: publicationDoc.id,
          url: "https://danyalrahujo.github.io/volume-pwa/"
        }
      });

      console.log(
        `Publication ${publicationDoc.id}: ` +
        `${response.successCount} sent, ` +
        `${response.failureCount} failed.`
      );

      await publicationDoc.ref.update({
        pushSentAt: Timestamp.now()
      });

      console.log(
        `Publication ${publicationDoc.id} marked as notified.`
      );
    }
  } catch (error) {
    console.error(
      "Publication processor error:",
      error
    );

    process.exitCode = 1;
  }
}

processPublications();