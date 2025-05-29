// src/components/Button.tsx


interface ButtonProps {
	label: string,
	onClick: () => void,
	className?: string,
}

const Button = ({label, onClick, className = ''}: ButtonProps) => {
	return (
		<button onClick={onClick} className={`px-6 py-3 bg-white text-black rounded-x1 font-medium shadow-md hover:bg-gray-200 transitions ${className}`}>
		    {label}
		</button>
	)
}

export default Button
