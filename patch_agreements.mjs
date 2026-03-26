import fs from 'fs';

const pagePath = 'src/pages/MyAgreements.jsx';
let content = fs.readFileSync(pagePath, 'utf8');

// Use useLocation to parse URL params
const oldImports = `import { useNavigate } from 'react-router-dom';`;
const newImports = `import { useNavigate, useLocation } from 'react-router-dom';`;

content = content.replace(oldImports, newImports);

// Inside MyAgreements component, add logic to check for URL params
const hookFind = `const MyAgreements = () => {
  const navigate = useNavigate();`;

const hookReplace = `const MyAgreements = () => {
  const navigate = useNavigate();
  const location = useLocation();`;

content = content.replace(hookFind, hookReplace);

// Add the useEffect to open modal after acordos are loaded
const afterLoadEffectFind = `  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setIsLoading(false);
        return;
      }

      const role = user.user_metadata?.tipo_perfil || 'Passageiro';
      setUserRole(role);
      setUserId(user.id);
      await carregarAcordos(user.id, role);
    };
    init();
  }, [carregarAcordos]);`;

const afterLoadEffectReplace = `  useEffect(() => {
    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setIsLoading(false);
        return;
      }

      const role = user.user_metadata?.tipo_perfil || 'Passageiro';
      setUserRole(role);
      setUserId(user.id);
      await carregarAcordos(user.id, role);
    };
    init();
  }, [carregarAcordos]);

  // Deep Linking: Auto-open the details modal based on URL query parameter or Router State
  useEffect(() => {
    if (!isLoading && acordos.length > 0) {
      const params = new URLSearchParams(location.search);
      const openAcordoId = params.get('openAcordoId') || location.state?.openAcordoId;

      if (openAcordoId) {
        const acordoToOpen = acordos.find(a => a.id === openAcordoId);
        if (acordoToOpen) {
          handleShowDetails(acordoToOpen);

          // Optional: Clean up the URL to avoid re-triggering on refresh
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    }
  }, [isLoading, acordos, location.search, location.state, navigate, location.pathname]);`;

content = content.replace(afterLoadEffectFind, afterLoadEffectReplace);

fs.writeFileSync(pagePath, content);
