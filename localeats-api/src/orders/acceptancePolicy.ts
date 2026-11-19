import {OrderContractError} from './orderContract.js';
export function assertPickupReception(shop:unknown):void{
 if(process.env.PICKUP_ACCEPTANCE_ENABLED!=='true')return;
 const paused=(shop as {pickup_reception_paused?:unknown})?.pickup_reception_paused;
 if(typeof paused!=='boolean')throw new OrderContractError(503,'ACCEPTANCE_UNAVAILABLE','Shop reception could not be verified.');
 if(paused)throw new OrderContractError(409,'SHOP_RECEPTION_PAUSED','This shop is not receiving new orders. Try another nearby shop.');
}
