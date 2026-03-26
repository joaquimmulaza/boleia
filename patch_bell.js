const fs = require('fs');

const bellPath = 'src/components/NotificationBell.jsx';
let content = fs.readFileSync(bellPath, 'utf8');

// Add import
const importToAdd = "import { resolveNotificationRoute } from '../utils/notificationRouter';\n";
content = content.replace("import { usePushNotifications } from '../hooks/usePushNotifications';", "import { usePushNotifications } from '../hooks/usePushNotifications';\n" + importToAdd);

// Replace handleNotificationClick logic
const oldHandleClick = `  const handleNotificationClick = (notif) => {
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
  };`;

const newHandleClick = `  const handleNotificationClick = (notif) => {
    if (!notif.lida) {
      markAsRead(notif.id);
    }
    setIsOpen(false);

    // Utiliza o Strategy Padrão de Roteamento (Escalabilidade de UX)
    const targetUrl = resolveNotificationRoute(notif);
    navigate(targetUrl);
  };`;

content = content.replace(oldHandleClick, newHandleClick);

fs.writeFileSync(bellPath, content);
