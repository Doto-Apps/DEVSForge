import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const registerSchema = z
	.object({
		email: z.string().email().nonempty("Email is required"),
		password: z.string().min(5, "Password must be at least 5 characters long"),
		confirmPassword: z
			.string()
			.min(5, "Confirm Password must be at least 5 characters long"),
		username: z.string().min(5, "Pseudo must be at least 5 characters long"),
		fullname: z.string().min(5, "Fullname must be at least 5 characters long"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
	});

export const RegisterForm = () => {
	const { register } = useAuth();
	const form = useForm({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			email: "admin@gmail.com",
			password: "Admin123",
			confirmPassword: "Admin123",
			username: "Admin",
			fullname: "John Doe",
		},
	});

	const handleRegister = async (values: z.infer<typeof registerSchema>) => {
		try {
			await register(values.email, values.password);
		} catch {
			form.setError("email", { message: "Registration failed" });
		}
	};

	return (
		<Card className="mx-auto max-w-md">
			<CardHeader>
				<CardTitle className="text-2xl">Register</CardTitle>
				<CardDescription>
					Enter your details below to create a new account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleRegister)}
						className="space-y-6"
					>
						<FormField
							name="email"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input {...field} placeholder="example@email.com" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="username"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<Input {...field} placeholder="Username" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="fullname"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Full Name</FormLabel>
									<FormControl>
										<Input {...field} placeholder="Full Name" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="password"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<Input {...field} placeholder="********" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="confirmPassword"
							control={form.control}
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm Password</FormLabel>
									<FormControl>
										<Input {...field} placeholder="********" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full">
							Register
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
