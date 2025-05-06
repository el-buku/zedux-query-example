interface QueryDisplayProps {
    title: string;
    buttons: React.ReactNode;
    children: React.ReactNode;
}
export const QueryDisplay: React.FC<QueryDisplayProps> = ({
    title, buttons, children,
}) => {
    return (
        <div className="w-[30rem] h-[30rem] flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
            <span className="text-white text-11 font-book block w-full whitespace-break-spaces break-words">
                {children}
            </span>
            <div className="flex gap-4 mt-8">{buttons}</div>
        </div>
    );
};
