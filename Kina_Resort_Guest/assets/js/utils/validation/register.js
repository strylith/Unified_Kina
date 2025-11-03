// Registration form validation utilities

export function validateField(name, value, allValues = {}) {
	const errors = {};
	const v = (value || '').trim();
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

	switch (name) {
		case 'firstName':
			if (!v) errors.firstName = 'First name is required';
			break;
		case 'lastName':
			if (!v) errors.lastName = 'Last name is required';
			break;
		case 'email':
			if (!v) errors.email = 'Email is required';
			else if (!emailRegex.test(v)) errors.email = 'Enter a valid email address';
			break;
		case 'password':
			if (!v) errors.password = 'Password is required';
			else if (v.length < 8) errors.password = 'Password must be at least 8 characters';
			if (allValues.confirmPassword && v !== (allValues.confirmPassword || '').trim()) {
				errors.confirmPassword = 'Passwords do not match';
			}
			break;
		case 'confirmPassword':
			if (!v) errors.confirmPassword = 'Please confirm your password';
			else if (v !== (allValues.password || '').trim()) errors.confirmPassword = 'Passwords do not match';
			break;
		case 'agreements': {
			const { termsAgreed, privacyAgreed, cookiesAgreed, personalInfoAgreed } = allValues;
			if (!termsAgreed || !privacyAgreed || !cookiesAgreed || !personalInfoAgreed) {
				errors.agreements = 'Please accept all agreements to continue';
			}
			break;
		}
		default:
			break;
	}
	return errors;
}

export function validateRegister(values) {
	const fields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'];
	let errors = {};
	fields.forEach((f) => {
		errors = { ...errors, ...validateField(f, values[f], values) };
	});
	errors = { ...errors, ...validateField('agreements', null, values) };
	return errors;
}

export function firstErrorKey(errors) {
	return Object.keys(errors || {})[0] || null;
}









