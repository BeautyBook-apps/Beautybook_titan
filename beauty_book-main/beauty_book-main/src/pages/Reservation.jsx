import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { entities } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import StepUnifiedReservation from "@/components/reservation/StepUnifiedReservation";
import StepQuestionnaire from "@/components/reservation/StepQuestionnaire";
import StepConfirmation from "@/components/reservation/StepConfirmation";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthModal from "@/components/ui/AuthModal";

export default function Reservation() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const proEmail = state?.service?.pro_email || state?.proEmail || state?.bundle?.pro_email || null;
  const { showAuthModal, authMessage, requireAuth, closeAuthModal } = useAuthGate();

  const [step, setStep] = useState(1);
  const [proProfile, setProProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(proEmail));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        requireAuth("Connectez-vous pour effectuer une réservation.");
      }
    }).catch(() => requireAuth("Connectez-vous pour effectuer une réservation."));
  }, []);

  useEffect(() => {
    if (!proEmail) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    entities.ProfilPro.filter({ user_email: proEmail }, "-created_at", 1)
      .then(res => { if (res[0]) setProProfile(res[0]); })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [proEmail]);

  const [booking, setBooking] = useState({
    services: state?.services || (state?.service ? [{ ...state.service, persons: 1 }] : []),
    bundle: state?.bundle || null,
    expert: null,
    date: null,
    time: null,
    seat: null,
    persons: state?.nbPers || state?.services?.[0]?.persons || 1,
    customAnswers: {},
    salon: { name: state?.service?.pro_name || "Professionnel BeautyBook", address: state?.service?.pro_city || "" },
  });

  const updateBookingData = (dataObj) => setBooking(prev => ({ ...prev, ...dataObj }));

  if (step === 1) {
    return (
      <>
        <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />
        <StepUnifiedReservation
          booking={booking}
          proProfile={proProfile}
          profileLoading={profileLoading}
          onUpdateBooking={updateBookingData}
          onNext={() => setStep(2)}
          onBack={() => navigate(-1)}
        />
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />
        <StepQuestionnaire
          booking={booking}
          onUpdateBooking={updateBookingData}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      </>
    );
  }

  return (
    <>
      <AuthModal open={showAuthModal} onClose={closeAuthModal} message={authMessage} />
      <StepConfirmation
        booking={booking}
        onConfirm={() => navigate("/")}
        onBack={() => setStep(2)}
      />
    </>
  );
}
