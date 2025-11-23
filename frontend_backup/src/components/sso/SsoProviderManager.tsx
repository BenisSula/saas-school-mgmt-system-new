import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface SsoProvider {
  id: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  is_default: boolean;
  jit_provisioning: boolean;
}

export const SsoProviderManager: React.FC = () => {
  const [samlProviders, setSamlProviders] = useState<SsoProvider[]>([]);
  const [oauthProviders, setOauthProviders] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const [samlResult, oauthResult] = await Promise.all([
        api.sso.getSamlProviders(),
        api.sso.getOAuthProviders()
      ]);
      setSamlProviders(samlResult.providers as SsoProvider[]);
      setOauthProviders(oauthResult.providers as SsoProvider[]);
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading SSO providers...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">SSO Provider Management</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">SAML 2.0 Providers</h3>
        <div className="space-y-2">
          {samlProviders.map((provider) => (
            <div key={provider.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{provider.provider_name}</span>
                  {provider.is_default && (
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Default</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    provider.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {provider.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {provider.jit_provisioning && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      JIT Enabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">OAuth2/OIDC Providers</h3>
        <div className="space-y-2">
          {oauthProviders.map((provider) => (
            <div key={provider.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{provider.provider_name}</span>
                  <span className="ml-2 text-sm text-gray-600">({provider.provider_type})</span>
                  {provider.is_default && (
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Default</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    provider.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {provider.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {provider.jit_provisioning && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      JIT Enabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

