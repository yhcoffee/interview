// Realtime Database + Firebase Authentication; imports load directly in the browser.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getDatabase,ref,onValue,set,remove,update} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

const config=window.YIHUI_INTERVIEW_FIREBASE_CONFIG;
const emit=(event,detail={})=>window.dispatchEvent(new CustomEvent('yihui-interview-'+event,{detail}));
const required=['apiKey','authDomain','databaseURL','projectId','appId','adminUid'];
const configured=!!config && required.every(k=>typeof config[k]==='string'&&!!config[k].trim()&&!/^(PASTE_|YOUR_)/.test(config[k])&&!config[k].includes('YOUR_'));

if(!configured){
  emit('unconfigured');
} else {
  try {
    const app=initializeApp(config);
    const auth=getAuth(app);
    const db=getDatabase(app);
    const candidates=ref(db,'candidates');
    const safeKey=id=>encodeURIComponent(String(id)).replace(/\./g,'%2E');
    const assertAdmin=()=>{if(auth.currentUser?.uid!==config.adminUid)throw Error('Not authorized as interview administrator')};
    let unsubscribe=()=>{};
    window.YihuiInterviewFirebase={
      signIn:async(email,password)=>{
        const {user}=await signInWithEmailAndPassword(auth,email,password);
        if(user.uid!==config.adminUid){await signOut(auth);throw Error('This account does not match the authorized interview admin UID')}
        return user;
      },
      signOut:()=>signOut(auth),
      saveRecord:r=>{assertAdmin();if(!r||typeof r.id!=='string'||!r.id)throw Error('Missing candidate ID');return set(ref(db,'candidates/'+safeKey(r.id)),r)},
      deleteRecord:id=>{assertAdmin();return remove(ref(db,'candidates/'+safeKey(id)))},
      importRecords:rs=>{assertAdmin();if(!Array.isArray(rs)||!rs.length)return Promise.resolve();const patch={};for(const r of rs){if(!r||typeof r.id!=='string'||!r.id)throw Error('Imported candidate is missing an ID');patch[safeKey(r.id)]=r}return update(candidates,patch)}
    };
    onAuthStateChanged(auth,user=>{
      unsubscribe();unsubscribe=()=>{};
      const authorized=!!(user&&user.uid===config.adminUid);
      emit('auth',{authorized,uid:user?.uid||null});
      if(authorized){
        unsubscribe=onValue(candidates,snapshot=>{
          const value=snapshot.val();
          const records=value&&typeof value==='object'?Object.values(value):[];
          emit('data',{records});
        },error=>emit('error',{message:error.message||String(error)}));
      } else if(user){
        signOut(auth).catch(error=>emit('error',{message:error.message||String(error)}));
      }
    },error=>emit('error',{message:error.message||String(error)}));
  }catch(error){emit('error',{message:error.message||String(error)})}
}
