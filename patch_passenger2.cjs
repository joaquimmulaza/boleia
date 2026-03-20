const fs = require('fs');
let content = fs.readFileSync('src/pages/PassengerDashboard.jsx', 'utf8');

content = content.replace(
  /<input\s+className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-full py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary\/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"\s+placeholder="Ponto de Partida"\s+type="text"\s+value={origem}\s+onChange={\(e\) => setOrigem\(e.target.value\)}\s+\/>/g,
  '<SearchAddressInput\n                                            id="origem"\n                                            name="origem"\n                                            placeholder="Ponto de Partida"\n                                            value={origem}\n                                            onChange={setOrigem}\n                                        />'
);

content = content.replace(
  /<input\s+className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-full py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary\/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"\s+placeholder="Ponto de Chegada"\s+type="text"\s+value={destino}\s+onChange={\(e\) => setDestino\(e.target.value\)}\s+\/>/g,
  '<SearchAddressInput\n                                            id="destino"\n                                            name="destino"\n                                            placeholder="Ponto de Chegada"\n                                            value={destino}\n                                            onChange={setDestino}\n                                        />'
);

fs.writeFileSync('src/pages/PassengerDashboard.jsx', content);
