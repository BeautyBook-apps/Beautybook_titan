import { ArrowLeft, Users, MapPin, Shield, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "@/components/ui/BrandLogo";

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="font-display min-h-full pb-24 bg-[#f8f9fa]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 sticky top-0 z-10 bg-white border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div>
          <h1 className="text-[22px] font-black text-gray-900">À propos</h1>
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">BeautyBook</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-5 pt-8 pb-6 text-center">
        <div className="w-20 h-20 mx-auto flex items-center justify-center mb-4">
          <BrandLogo size={80} alt="Logo BeautyBook" className="rounded-2xl shadow-lg shadow-primary/20" />
        </div>
        <h1 className="text-[28px] font-black text-gray-900 leading-tight">
          BeautyBook — La première plateforme beauté et bien-être
        </h1>
        <p className="text-[14px] text-gray-500 font-medium mt-3 max-w-lg mx-auto leading-relaxed">
          Connecter les clients avec les meilleurs professionnels de la beauté, simplifier la réservation
          et offrir une expérience immersive unique.
        </p>
      </div>

      {/* Content */}
      <div className="px-5 space-y-8">
        <section>
          <h2 className="text-[18px] font-black text-gray-900 mb-3">Ce que nous faisons</h2>
          <p className="text-[14px] text-gray-600 font-medium leading-relaxed">
            BeautyBook est une plateforme innovante qui révolutionne la manière dont les clients
            découvrent et réservent des services de beauté. Coiffure, maquillage, soins du visage,
            manucure, massage, épilation — nous réunissons l'ensemble des prestations beauté en un
            seul et même endroit. Grâce à notre technologie de visite virtuelle 3D, les clients
            peuvent explorer les salons avant même de s'y rendre, créant ainsi une confiance et une
            transparence inégalées dans le secteur.
          </p>
          <p className="text-[14px] text-gray-600 font-medium leading-relaxed mt-3">
            Notre marketplace intégrée permet aux professionnels de vendre leurs produits directement
            via l'application, tandis que notre système de réservation intelligent gère les agendas,
            les rappels et les paiements en toute simplicité. BeautyBook intègre également un
            programme de fidélité, des avis clients vérifiés, et un assistant IA nommé Maria qui
            aide les utilisateurs à trouver le service parfait selon leurs besoins et leurs
            préférences.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-black text-gray-900 mb-3">À qui s'adresse BeautyBook ?</h2>
          <p className="text-[14px] text-gray-600 font-medium leading-relaxed">
            BeautyBook s'adresse à deux publics : les clients à la recherche de services beauté de
            qualité, et les professionnels — salons, coiffeurs indépendants, esthéticiennes,
            maquilleurs et barbiers — qui souhaitent développer leur activité. Que vous cherchiez
            une coupe tendance, un soin relaxant ou un maquillage professionnel pour un événement
            spécial, BeautyBook vous met en relation avec des experts vérifiés près de chez vous.
            Pour les professionnels, nous offrons des outils de gestion complets : catalogue de
            services, agenda intelligent, statistiques de performance, visibilité locale optimisée
            et un abonnement flexible adapté à chaque taille d'activité.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-black text-gray-900 mb-3">Qui sommes-nous ?</h2>
          <p className="text-[14px] text-gray-600 font-medium leading-relaxed">
            BeautyBook a été créé par une équipe passionnée de technologie et de beauté, convaincue
            que le secteur méritait une plateforme moderne, intuitive et complète. Nous travaillons
            chaque jour pour offrir la meilleure expérience possible à nos utilisateurs, en écoutant
            leurs retours et en améliorant constamment notre application. Notre mission est de
            digitaliser et démocratiser l'accès aux services beauté, tout en valorisant le
            savoir-faire des professionnels du secteur. Basés en France, nous sommes fiers de
            contribuer à l'écosystème beauté local et de soutenir les talents indépendants comme
            les enseignes établies.
          </p>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Utilisateurs", value: "10 000+" },
            { icon: MapPin, label: "Pro en France", value: "500+" },
            { icon: Star, label: "Avis vérifiés", value: "4,8/5" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
              <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-[20px] font-black text-gray-900">{value}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <section className="pb-8">
          <h2 className="text-[18px] font-black text-gray-900 mb-3">Notre engagement</h2>
          <p className="text-[14px] text-gray-600 font-medium leading-relaxed">
            La confiance est au cœur de notre plateforme. Tous les professionnels sont vérifiés,
            les avis sont authentiques et certifiés, et vos données personnelles sont protégées
            avec les plus hauts standards de sécurité. Nous nous engageons à offrir une expérience
            transparente, équitable et respectueuse pour tous — clients comme professionnels.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-[12px] font-black text-gray-500 uppercase tracking-wider">Sécurité et transparence garanties</span>
          </div>
        </section>
      </div>
    </div>
  );
}
