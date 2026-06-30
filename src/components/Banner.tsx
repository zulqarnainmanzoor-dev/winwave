import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

interface SlideData {
  id: number;
  image: string;
  fallbackImage: string;
}

export default function Banner() {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDistance, setDragDistance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 50) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (diff < -50) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragDistance(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragDistance(e.clientX - dragStartX);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = dragStartX - e.clientX;
    if (diff > 50) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (diff < -50) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
    setDragDistance(0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDragDistance(0);
  };

  const slides: SlideData[] = [
    {
      id: 1,
      image: "/assets/banners/Join Win wave as an Agent.jpeg",
      fallbackImage: "/assets/banners/Winwave Code Bonus.jpeg",
    },
    {
      id: 2,
      image: "/assets/banners/VIP Rebate Bonus.jpeg",
      fallbackImage: "/assets/banners/Winwave Code Bonus.jpeg",
    },
    {
      id: 3,
      image: "/assets/banners/Winning Information of WinGo.png",
      fallbackImage: "/assets/banners/Winwave Code Bonus.jpeg",
    },
    {
      id: 4,
      image: "/assets/banners/Winning information of Casino.png",
      fallbackImage: "/assets/banners/Winwave Code Bonus.jpeg",
    },
    {
      id: 5,
      image: "/assets/banners/Winning Information of K3.png",
      fallbackImage: "/assets/banners/Winwave Code Bonus.jpeg",
    },
    {
      id: 6,
      image: "/assets/banners/Winwave Code Bonus.jpeg",
      fallbackImage: "/assets/banners/Join Win wave as an Agent.jpeg",
    },
    {
      id: 7,
      image: "/assets/banners/scam Alert.jpeg",
      fallbackImage: "/assets/banners/Join Win wave as an Agent.jpeg",
    },
  ];

  // Infinite sliding loop - Slower pace as requested
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "/assets/banner.png";
  };

  return (
    <div className="px-4 py-4">
      {/* Banner viewport */}
      <div 
        className="w-full aspect-[2/1] bg-[#1C1C1F] rounded-3xl relative overflow-hidden border border-white/5 shadow-2xl group cursor-grab active:cursor-grabbing select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-white/5 flex flex-col justify-center p-6 gap-3">
             <div className="h-3 w-20 bg-white/10 rounded-full" />
             <div className="h-8 w-40 bg-white/10 rounded-lg" />
             <div className="h-6 w-32 bg-white/10 rounded-lg" />
          </div>
        ) : (
          /* Sliding wrapper */
          <div
            className="flex h-full w-full transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(calc(-${currentIndex * 100}% + ${dragDistance}px))` }}
          >
            {slides.map((slide) => (
              <div key={slide.id} className="w-full h-full flex-shrink-0 relative">
                <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-500/10 blur-[80px] rounded-full z-0"></div>

                {/* Banner custom image tag with error fallback */}
                <img
                  src={slide.image}
                  onError={handleImageError}
                  alt={`banner-${slide.id}`}
                  className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination dots container */}
      <div className="flex justify-center items-center mt-4">
        {isLoading ? (
          <div className="h-2 w-32 bg-white/5 animate-pulse rounded-full" />
        ) : (
          <div className="flex gap-2 py-2">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                  i === currentIndex ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
