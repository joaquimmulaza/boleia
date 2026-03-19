import React from 'react';
import { Car, Eye, EyeOff } from 'lucide-react';
import { useAuthForm } from '../hooks/useAuthForm';

/**
 * @typedef {Readonly<{}>} AuthProps
 * Page component — accepts no external props.
 */

const Auth = () => {
  const {
    isLogin,
    profileType,
    showPassword,
    email,
    password,
    nome,
    telefone,
    feedback,
    errors,
    isLoading,
    setEmail,
    setPassword,
    setNome,
    setTelefone,
    setProfileType,
    setShowPassword,
    setErrors,
    handleSubmit,
    handleToggleMode,
  } = useAuthForm();

  return (
    <div className="font-[Plus Jakarta Sans,sans-serif] min-h-screen bg-white text-gray-800 antialiased flex flex-col items-center justify-center p-0 sm:p-4">
      <div className="relative flex min-h-screen sm:min-h-[812px] max-w-[400px] w-full flex-col bg-white overflow-hidden shadow-none sm:shadow-xl sm:rounded-3xl border-0 sm:border border-gray-100">
        
        {/* Header Section */}
        <div className="flex flex-col items-center pt-16 pb-8 px-8 text-center">
          <div className="text-emerald-500 mb-6 bg-emerald-50 p-4 rounded-full">
            <Car size={40} className="text-emerald-500" />
          </div>
          <h1 className="text-gray-800 text-3xl font-bold tracking-tight mb-2">Boleia Certa</h1>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-[260px]">
            Mobilidade urbana limpa e partilhada.
          </p>
        </div>

        {/* Profile Toggle — apenas em modo Criar Conta */}
        {!isLogin && (
          <div className="px-8 mb-6">
            <div className="flex relative h-14 w-full items-center justify-center rounded-full bg-gray-50 p-1.5 border border-gray-200 shadow-inner">
              <label className={`flex h-full grow cursor-pointer items-center justify-center rounded-full px-4 transition-all duration-300 ${profileType === 'Passageiro' ? 'bg-emerald-500 text-white shadow-md' : 'text-gray-500 hover