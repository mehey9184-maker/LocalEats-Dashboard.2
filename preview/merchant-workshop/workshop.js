(() => {
  "use strict";
  // This isolated training page deliberately has no fetch, XHR, SDK, storage or API code.
  // State exists only as browser memory and vanishes on refresh/navigation.
  const names=["Fictional Customer A","Fictional Customer B","Fictional Customer C"];
  const orders=[];let nextId=0;
  const byId=id=>document.getElementById(id);
  const list=byId("orders-list");const announcements=byId("announcement");
  const stages={pending:"New · Waiting",preparing:"Preparing",ready:"Ready for pickup",collected:"Collected"};
  function announce(message){announcements.textContent=message;}
  function makeButton(label,onClick){
    const button=document.createElement("button");
    button.type="button";button.textContent=label;button.addEventListener("click",onClick);
    return button;
  }
  function transition(order,action){
    if(action==="accept"&&order.status==="pending")order.status="preparing";
    else if(action==="ready"&&order.status==="preparing")order.status="ready";
    else if(action==="pay"&&order.status==="ready"&&!order.paid)order.paid=true;
    else if(action==="collect"&&order.status==="ready"&&order.paid)order.status="collected";
    else return;
    announce("Demo ticket "+order.id+": "+(action==="pay"?"fictional counter payment marked":stages[order.status])+". No real transaction occurred.");
    render();
  }
  function render(){
    for(const key of ["pending","preparing","ready","collected"])
      byId("count-"+key).textContent=String(orders.filter(o=>o.status===key).length);
    list.replaceChildren();
    if(orders.length===0){
      const empty=document.createElement("div");empty.className="empty";
      const h=document.createElement("h3");h.textContent="No example orders yet";
      const p=document.createElement("p");p.textContent="Simulate an order to practise. Only fictional customer names are used.";
      empty.append(h,p);list.append(empty);return;
    }
    for(const order of orders){
      const card=document.createElement("article");card.className="ticket";
      const head=document.createElement("div");head.className="ticket-head";
      const summary=document.createElement("div");
      const label=document.createElement("div");label.className="label";label.textContent="FAKE · TEST ONLY · #"+order.id;
      const h=document.createElement("h3");h.textContent=order.name;
      summary.append(label,h);
      const stage=document.createElement("span");stage.className="stage";stage.textContent=stages[order.status];
      head.append(summary,stage);
      const contents=document.createElement("p");contents.textContent="1 × Classic Kota · R25.00 · Collection · Example only";
      const payment=document.createElement("p");payment.textContent=order.paid?"Payment simulated — no money moved":"Customer pays at shop (simulation)";
      const actions=document.createElement("div");actions.className="ticket-actions";
      if(order.status==="pending")actions.append(makeButton("Accept order",()=>transition(order,"accept")));
      if(order.status==="preparing")actions.append(makeButton("Mark food ready",()=>transition(order,"ready")));
      if(order.status==="ready"&&!order.paid)actions.append(makeButton("Simulate counter payment",()=>transition(order,"pay")));
      if(order.status==="ready"&&order.paid)actions.append(makeButton("Mark collected",()=>transition(order,"collect")));
      card.append(head,contents,payment,actions);list.append(card);
    }
  }
  byId("create-order").addEventListener("click",()=>{
    if(orders.length>=15){announce("Demo limited to 15 fictional tickets. Reset to continue.");return;}
    nextId+=1;orders.unshift({id:nextId,name:names[(nextId-1)%names.length],status:"pending",paid:false});
    announce("Fictional example ticket "+nextId+" created locally. No real order was placed.");
    render();
  });
  byId("clear-orders").addEventListener("click",()=>{orders.length=0;nextId=0;announce("Fictional tickets cleared from this browser memory.");render();});
  for(const link of document.querySelectorAll(".nav"))link.addEventListener("click",()=>{
    for(const other of document.querySelectorAll(".nav")){other.classList.remove("active");other.removeAttribute("aria-current");}
    link.classList.add("active");link.setAttribute("aria-current","page");
  });
  render();
})();