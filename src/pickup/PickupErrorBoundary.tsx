import React from "react";
export class PickupErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(this.state.failed)return <main className="pickup-app"><section><h1>LocalEats could not display this page</h1><p>Reload to recover your orders from the API. Saved retry requests are retained.</p><button onClick={()=>window.location.reload()}>Reload</button></section></main>;
  return this.props.children;
 }
}
