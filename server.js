const admin = require("firebase-admin");
const axios = require("axios");

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function sendUpcomingRendezvousNotifications() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    console.log("Début de la fonction. Maintenant :", now, "Une heure plus tard :", oneHourLater);

    try {
        const rendezvousSnapshot = await db.collection("logements").get();

        if (rendezvousSnapshot.empty) {
            console.log("Aucun logement.");
            return;
        }

        console.log(`Nombre de rendez-vous trouvés : ${rendezvousSnapshot.size}`);
        const sendNotifications = [];

        for (const doc of rendezvousSnapshot.docs) {
            const rendezvousData = doc.data();
            const userId = rendezvousData.idProprietaire;

            const diffMinutes = 1;
            let messageBody;

            const notifiedTimes = rendezvousData.notifiedTimes || [];
            if (notifiedTimes.includes(diffMinutes)) {
                console.log(`Notification déjà envoyée pour ${diffMinutes} min avant.`);
                continue;
            }

            if (diffMinutes < 1) {
                messageBody = `Votre rendez-vous commence maintenant !`;
            } else if (diffMinutes < 60) {
                messageBody = `Votre rendez-vous est prévu dans ${diffMinutes} minutes.`;
            } else {
              
                messageBody = `Votre rendez-vous est prévu à ${0}.`;
            }

            const userDoc = await db.collection("users").doc(userId).get();
            if (!userDoc.exists) {
                console.log(`Utilisateur ${userId} non trouvé.`);
                continue;
            }
            const userData = userDoc.data();
            const fcmToken = userData.fcmToken;
            if (!fcmToken) {
                console.log(`Token FCM manquant pour l'utilisateur ${userId}.`);
                continue;
            }

            const message = {
                token: fcmToken,
                notification: {
                    title: "Rappel de rendez-vous",
                    body: messageBody,
                },
                android: {priority: "high"},
                apns: {
                    payload: {
                        aps: {contentAvailable: true, sound: "default"},
                    },
                },
            };

            sendNotifications.push(admin.messaging().send(message));
            notifiedTimes.push(diffMinutes);
            if (diffMinutes <= 0) {
                await db.collection("rendezvous").doc(doc.id).update({notifiedTimes: []});
            }
        }

        await Promise.all(sendNotifications);
        console.log("Toutes les notifications ont été envoyées.");
    } catch (error) {
        console.error("Erreur lors de l'envoi des notifications :", error);
    }
}

// Exécuter toutes les 1 minute
setInterval(sendUpcomingRendezvousNotifications, 60 * 1000);

console.log("Le serveur tourne en continu...");
