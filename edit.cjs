const fs = require('fs');
const file = 'src/components/NotificationBell.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import { useNavigate }")) {
  content = content.replace(
    "import React, { useState, useRef, useEffect } from 'react';",
    "import React, { useState, useRef, useEffect } from 'react';\nimport { useNavigate } from 'react-router-dom';"
  );
}

if (!content.includes("const navigate = useNavigate();")) {
  content = content.replace(
    "const dropdownRef = useRef(null);",
    "const dropdownRef = useRef(null);\n  const navigate = useNavigate();"
  );
}

const handleClickFunc = `
  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    // Bónus UX: Tentar usar link ou deduzir baseado no tipo/mensagem se não houver
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.mensagem && notif.mensagem.toLowerCase().includes('motorista')) {
      navigate('/driver-dashboard');
    } else if (notif.mensagem && notif.mensagem.toLowerCase().includes('passageiro')) {
      navigate('/passenger-dashboard');
    } else if (notif.mensagem && (notif.mensagem.toLowerCase().includes('rota') || notif.mensagem.toLowerCase().includes('viagem'))) {
      navigate('/my-routes');
    } else {
      navigate('/my-agreements');
    }
  };
`;

if (!content.includes("const handleNotificationClick")) {
  content = content.replace(
    "const handlePushToggle = async () => {",
    handleClickFunc + "\n  const handlePushToggle = async () => {"
  );
}

content = content.replace(
  `                    onClick={() => {
                      if (!notif.lida) markAsRead(notif.id);
                    }}`,
  `                    onClick={() => handleNotificationClick(notif)}`
);

fs.writeFileSync(file, content);
