import {Router,type Response} from 'express';
import {getFirebaseBearerToken,type AuthenticatedRequest} from '../middleware/authenticateFirebase.js';
import {authAdmin} from '../lib/firebaseAdmin.js';
import {supabaseAdmin} from '../lib/supabaseAdmin.js';
import {OrderContractError} from '../orders/orderContract.js';
import {readAcceptanceInbox,readReception,resumeReception} from '../orders/acceptance.js';
const router=Router();
router.use(async(req:AuthenticatedRequest,res,next)=>{
 res.set('Cache-Control','private, no-store').set('Vary','Authorization, Origin');
 try{
  const token=getFirebaseBearerToken(req.headers.authorization);
  if(!token)throw Error('Unauthorized');
  const decoded=await authAdmin.verifyIdToken(token,true);
  if(!decoded.uid||decoded.firebase?.sign_in_provider==='anonymous')throw Error('Unauthorized');
  req.authUser={uid:decoded.uid,email:decoded.email??null,isAnonymous:false};next();
 }catch{res.status(401).json({success:false,code:'UNAUTHORIZED'});}
});
function errorResponse(res:Response,error:unknown){
 const known=error instanceof OrderContractError;
 res.status(known?error.status:503).json({success:false,code:known?error.code:'ACCEPTANCE_UNAVAILABLE'});
}
router.get('/pickup-acceptance/notices',async(req:AuthenticatedRequest,res)=>{
 try{res.json({success:true,...await readAcceptanceInbox(supabaseAdmin,req.authUser!.uid)});}catch(error){errorResponse(res,error);}
});
router.get('/merchant/shops/:shop/reception',async(req:AuthenticatedRequest,res)=>{
 try{res.json({success:true,...await readReception(supabaseAdmin,req.authUser!.uid,String(req.params.shop))});}catch(error){errorResponse(res,error);}
});
router.post('/merchant/shop/reception/resume',async(req:AuthenticatedRequest,res)=>{
 try{res.json({success:true,reception:await resumeReception(supabaseAdmin,req.authUser!.uid,req.body)});}catch(error){errorResponse(res,error);}
});
export default router;
