# Firebase Firestore Rules
# Paste these in Firebase Console > Firestore > Rules

# rules_version = '2';
# service cloud.firestore {
#   match /databases/{database}/documents {
#     match /users/{userId} {
#       allow read, write: if request.auth != null && request.auth.uid == userId;
#     }
#     match /conversations/{convId} {
#       allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
#       allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
#     }
#     match /messages/{msgId} {
#       allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
#       allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
#     }
#     match /payments/{payId} {
#       allow read: if request.auth != null && request.auth.uid == resource.data.userId;
#       allow write: if false;
#     }
#     match /{document=**} {
#       allow read, write: if false;
#     }
#   }
# }
