<template>
  <div style="max-width:960px;margin:24px auto">
    <h1>Simple pricing</h1>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:12px">
      <div style="border:1px solid #334155;border-radius:12px;padding:16px">
        <div>Starter</div><div style="font-size:28px">$0</div>
        <ul><li>Up to 5 requests/day</li><li>Basic analytics</li></ul>
        <button disabled style="margin-top:8px">Get started</button>
      </div>
      <div style="border:1px solid #334155;border-radius:12px;padding:16px">
        <div>Pro</div><div style="font-size:28px">$49</div>
        <ul><li>Unlimited requests</li><li>Priority support</li></ul>
        <button disabled style="margin-top:8px">Upgrade</button>
      </div>
      <div style="border:1px solid #334155;border-radius:12px;padding:16px">
        <div>Team</div><div style="font-size:28px">$99</div>
        <ul><li>Multiple agents</li><li>Team analytics</li></ul>
        <button disabled style="margin-top:8px">Contact sales</button>
      </div>
    </div>
  </div>
</template>
