"use client"

import React, { useState } from 'react'
import { 
    Search, X, HelpCircle, ChevronDown, Loader2,
    // Fitness
    Dumbbell, BicepsFlexed, Bike, Trophy, Activity, Timer, Footprints, Zap, Medal, Target, PersonStanding, Flame, Sword, HeartPulse, Crosshair, Crown, Scale, MapPin,
    // Science & Academics
    FlaskConical, Beaker, Atom, Dna, Microscope, Pi, Divide, Infinity, Magnet, Orbit, Binary, Sigma,
    // Agriculture & Nature
    Wheat, Tractor, Shovel, Sprout, Leaf, Flower2, Trees, TreePine, Bird, Dog, Cat, Fish, Waves, Palmtree, Wind, Sparkles, Gem, Bug, Ghost, Snowflake,
    // Social & Community
    Users, UsersRound, MessageCircle, MessageSquare, Share2, Handshake, HeartHandshake, Globe, Smile, Languages,
    // Health & Wellness
    Heart, Brain, Apple, GlassWater, Coffee, Grape, Pizza, Utensils, Stethoscope, Moon, Sun, Pill, ShowerHead, Droplet, Thermometer, Bed, Sunrise, Sunset,
    // Work & Study
    Book, BookOpen, Laptop, PenTool, FileText, Briefcase, BriefcaseBusiness, Lightbulb, Calendar, Clock, CheckSquare, Code, Pencil, Shield, Wrench, Hammer, Paperclip, Keyboard, Hourglass, Inbox, Notebook, School, Building2,
    // Financial & Money
    Wallet, PiggyBank, DollarSign, Coins, Banknote, Landmark, TrendingUp, Receipt, Percent, ShoppingBag, Gift, Key, Lock, Flag, Star, Bell, Car, Plane, ShoppingCart, Tag, Calculator,
    // Misc original icons
    Home, Trash2, Camera, Music, Phone, Mail, Cloud, Umbrella, Map, Compass, Gamepad, Gamepad2, Tent, Rocket, Mountain, Brush, Palette, Glasses, Headphones, Mic, Video, Smartphone, Watch, Monitor, Tv, Speaker, SpeakerIcon, Shirt, Scissors, Wand, StarHalf, Award, ShieldCheck, ChefHat, Wine, Volume2, Repeat, RotateCw, CalendarCheck
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export const ICON_MAP: Record<string, React.ElementType> = {
    Dumbbell, BicepsFlexed, Bike, Trophy, Activity, Timer, Footprints, Zap, Medal, Target, PersonStanding, Flame, Sword, HeartPulse, Crosshair, Crown, Scale, MapPin,
    FlaskConical, Beaker, Atom, Dna, Microscope, Pi, Divide, Infinity, Magnet, Orbit, Binary, Sigma,
    Wheat, Tractor, Shovel, Sprout, Leaf, Flower2, Trees, TreePine, Bird, Dog, Cat, Fish, Waves, Palmtree, Wind, Sparkles, Gem, Bug, Ghost, Snowflake,
    Users, UsersRound, MessageCircle, MessageSquare, Share2, Handshake, HeartHandshake, Globe, Smile, Languages,
    Heart, Brain, Apple, GlassWater, Coffee, Grape, Pizza, Utensils, Stethoscope, Moon, Sun, Pill, ShowerHead, Droplet, Thermometer, Bed, Sunrise, Sunset,
    Book, BookOpen, Laptop, PenTool, FileText, Briefcase, BriefcaseBusiness, Lightbulb, Calendar, Clock, CheckSquare, Code, Pencil, Shield, Wrench, Hammer, Paperclip, Keyboard, Hourglass, Inbox, Notebook, School, Building2,
    Wallet, PiggyBank, DollarSign, Coins, Banknote, Landmark, TrendingUp, Receipt, Percent, ShoppingBag, Gift, Key, Lock, Flag, Star, Bell, Car, Plane, ShoppingCart, Tag, Calculator,
    Home, Trash2, Camera, Music, Phone, Mail, Cloud, Umbrella, Map, Compass, Gamepad, Gamepad2, Tent, Rocket, Mountain, Brush, Palette, Glasses, Headphones, Mic, Video, Smartphone, Watch, Monitor, Tv, Speaker, SpeakerIcon, Shirt, Scissors, Wand, StarHalf, Award, ShieldCheck, ChefHat, Wine, Volume2, Repeat, RotateCw, CalendarCheck,
    HelpCircle, ChevronDown, Loader2
}

interface IconPickerProps {
    value?: string
    onChange: (iconName: string) => void
    onOpenChange?: (open: boolean) => void
}

const CATEGORIES = {
    "Fitness & Sport": [
        "Dumbbell", "BicepsFlexed", "Bike", "Trophy", "Activity", "Timer", "Footprints", "Zap", "Medal", "Target", "PersonStanding", "Flame", "Sword", "HeartPulse", "Crosshair", "Crown", "Scale", "MapPin"
    ],
    "Science & Academics": [
        "FlaskConical", "Beaker", "Atom", "Dna", "Microscope", "Pi", "Divide", "Infinity", "Magnet", "Orbit", "Binary", "Sigma", "GraduationCap", "School", "BrainCircuit"
    ],
    "Agriculture & Nature": [
        "Wheat", "Tractor", "Shovel", "Sprout", "Leaf", "Flower2", "Trees", "TreePine", "Bird", "Dog", "Cat", "Fish", "Waves", "Palmtree", "Wind", "Sparkles", "Gem", "Bug", "Ghost", "Snowflake"
    ],
    "Social & Community": [
        "Users", "UsersRound", "MessageCircle", "MessageSquare", "Share2", "Handshake", "HeartHandshake", "Globe", "Smile", "Languages"
    ],
    "Financial & Money": [
        "Wallet", "PiggyBank", "DollarSign", "Coins", "Banknote", "Landmark", "TrendingUp", "Receipt", "Percent", "ShoppingCart", "ShoppingBag", "Gift", "CreditCard"
    ],
    "Health & Wellness": [
        "Heart", "Brain", "Apple", "GlassWater", "Coffee", "Grape", "Pizza", "Utensils", "Stethoscope", "Moon", "Sun", "Pill", "ShowerHead", "Droplet", "Thermometer", "Bed", "Sunrise", "Sunset"
    ],
    "Work & Study": [
        "Book", "BookOpen", "Laptop", "PenTool", "FileText", "Briefcase", "BriefcaseBusiness", "Lightbulb", "Calendar", "Clock", "CheckSquare", "Code", "Pencil", "Shield", "Wrench", "Hammer", "Paperclip", "Keyboard", "Hourglass", "Inbox", "Notebook", "Building2"
    ],
    "Life & Habits": [
        "Home", "Trash2", "Camera", "Music", "Phone", "Mail", "Cloud", "Umbrella", "Map", "Compass", "Gamepad", "Gamepad2", "Tent", "Rocket", "Mountain", "Brush", "Palette", "Glasses", "Headphones", "Mic", "Video", "Smartphone", "Watch", "Monitor", "Tv", "Speaker", "SpeakerIcon", "Shirt", "Scissors", "Wand", "StarHalf", "Award", "ShieldCheck", "ChefHat", "Wine", "Volume2", "Repeat", "RotateCw", "CalendarCheck"
    ]
}

const ALL_ICON_NAMES = Object.values(CATEGORIES).flat()

export function IconPicker({ value, onChange, onOpenChange }: IconPickerProps) {
    const [search, setSearch] = useState("")
    const [isOpen, setIsOpen] = useState(false)

    const toggleOpen = (open: boolean) => {
        setIsOpen(open)
        if (onOpenChange) {
            onOpenChange(open)
        }
    }

    const IconComponent = (name: string) => {
        const Icon = ICON_MAP[name] || HelpCircle
        return <Icon className="w-5 h-5" />
    }

    const filteredIcons = ALL_ICON_NAMES.filter(name => 
        name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => toggleOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-background/50 hover:bg-white/5 transition-all text-sm animate-fade-in-up-fast"
            >
                <div className="flex items-center gap-3">
                    {value ? (
                        <div className="p-2 bg-primary/20 text-primary rounded-lg">
                            {IconComponent(value)}
                        </div>
                    ) : (
                        <div className="p-2 bg-white/5 text-muted-foreground rounded-lg">
                            <HelpCircle className="w-5 h-5" />
                        </div>
                    )}
                    <span className={value ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {value || "Seleccionar Icono"}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-[60] top-full mt-2 w-full max-h-80 overflow-y-auto backdrop-blur-2xl bg-white/70 dark:bg-zinc-950/45 p-4 rounded-2xl border border-primary/20 shadow-2xl no-scrollbar transform-gpu"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="sticky top-0 bg-gradient-to-b from-white/95 via-white/80 to-transparent dark:from-zinc-950/95 dark:via-zinc-950/80 dark:to-transparent pb-3 z-10 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white/15 dark:bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder-muted-foreground/60 transition-colors"
                                />
                            </div>
                            <button 
                                onClick={() => toggleOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {search ? (
                            <div className="grid grid-cols-5 gap-2">
                                {filteredIcons.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => {
                                            onChange(name)
                                            toggleOpen(false)
                                            setSearch("")
                                        }}
                                        className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${value === name ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'}`}
                                    >
                                        {IconComponent(name)}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(CATEGORIES).map(([cat, icons]) => (
                                    <div key={cat} className="space-y-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{cat}</h4>
                                        <div className="grid grid-cols-5 gap-2">
                                            {icons.map(name => (
                                                <button
                                                    key={name}
                                                    type="button"
                                                    onClick={() => {
                                                        onChange(name)
                                                        toggleOpen(false)
                                                    }}
                                                    className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${value === name ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-background/20 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-white/5'}`}
                                                >
                                                    {IconComponent(name)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

