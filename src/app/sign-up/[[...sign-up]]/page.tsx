import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
            <SignUp
                appearance={{
                    elements: {
                        formButtonPrimary: 'bg-indigo-500 hover:bg-indigo-600',
                        card: 'bg-slate-900 border border-slate-800',
                        headerTitle: 'text-white',
                        headerSubtitle: 'text-slate-400',
                        socialButtonsBlockButton: 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
                        formFieldLabel: 'text-slate-300',
                        formFieldInput: 'bg-slate-800 border-slate-700 text-white',
                        footerActionLink: 'text-indigo-400 hover:text-indigo-300',
                    },
                }}
            />
        </div>
    );
}
