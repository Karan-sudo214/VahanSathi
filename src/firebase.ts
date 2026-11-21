// Firebase is used only for customer authentication.
// The existing Neon/PostgreSQL database continues to store all VaahanSathi app data.
const firebaseConfig = {
  apiKey: "AIzaSyDJ7D_z1EitJPIYGsC-SrTdRWHMmvZNe7U",
  authDomain: "vahansathi-4ffae.firebaseapp.com",
  projectId: "vahansathi-4ffae",
  storageBucket: "vahansathi-4ffae.firebasestorage.app",
  messagingSenderId: "67628340656",
  appId: "1:67628340656:web:e3f18f219bbb89790af275"
};

type FirebaseRuntime = {
  auth: any;
  createUserWithEmailAndPassword: (auth: any, email: string, password: string) => Promise<any>;
  signInWithEmailAndPassword: (auth: any, email: string, password: string) => Promise<any>;
  GoogleAuthProvider: new () => any;
  signInWithPopup: (auth: any, provider: any) => Promise<any>;
  updateProfile: (user: any, profile: { displayName?: string }) => Promise<void>;
  signOut: (auth: any) => Promise<void>;
};

let runtimePromise: Promise<FirebaseRuntime> | null = null;

async function getRuntime(): Promise<FirebaseRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const appModuleUrl = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
      const authModuleUrl = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
      const [appSdk, authSdk] = await Promise.all([
        import(/* @vite-ignore */ appModuleUrl),
        import(/* @vite-ignore */ authModuleUrl)
      ]);
      const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
      const auth = authSdk.getAuth(app);
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      return {
        auth,
        createUserWithEmailAndPassword: authSdk.createUserWithEmailAndPassword,
        signInWithEmailAndPassword: authSdk.signInWithEmailAndPassword,
        GoogleAuthProvider: authSdk.GoogleAuthProvider,
        signInWithPopup: authSdk.signInWithPopup,
        updateProfile: authSdk.updateProfile,
        signOut: authSdk.signOut
      };
    })();
  }
  return runtimePromise;
}

export async function firebaseCustomerCreate(name: string, email: string, password: string) {
  const firebase = await getRuntime();
  const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email.trim(), password);
  await firebase.updateProfile(credential.user, { displayName: name.trim() });
  return credential;
}

export async function firebaseCustomerSignIn(email: string, password: string) {
  const firebase = await getRuntime();
  return firebase.signInWithEmailAndPassword(firebase.auth, email.trim(), password);
}

export async function firebaseGoogleSignIn() {
  const firebase = await getRuntime();
  const provider = new firebase.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebase.signInWithPopup(firebase.auth, provider);
}

export async function firebaseSignOut() {
  const firebase = await getRuntime();
  return firebase.signOut(firebase.auth);
}
