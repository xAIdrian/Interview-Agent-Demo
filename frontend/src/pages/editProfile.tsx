import React, { useState } from 'react';
import { PageTemplate } from '../components/PageTemplate';
import { PrimaryButton } from '../components/Button';
import { FormItem } from '../components/FormItem';

const EditProfile = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // ...handle form submission...
    };

    return (
        <PageTemplate title="Edit Profile" centered maxWidth="sm">
            <div className="w-full bg-white shadow-md rounded-lg p-6">
                <h2 className="text-2xl font-bold text-center mb-6">Edit Profile</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormItem
                        label="Name"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                    
                    <FormItem
                        label="Email"
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    
                    <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600 mb-4">
                            Leave password fields blank to keep your current password.
                        </p>
                        
                        <FormItem
                            label="Current Password"
                            id="current_password"
                            type="password"
                            name="current_password"
                            value={formData.current_password}
                            onChange={handleChange}
                        />
                        
                        <FormItem
                            label="New Password"
                            id="new_password"
                            type="password"
                            name="new_password"
                            value={formData.new_password}
                            onChange={handleChange}
                        />
                        
                        <FormItem
                            label="Confirm New Password"
                            id="confirm_password"
                            type="password"
                            name="confirm_password"
                            value={formData.confirm_password}
                            onChange={handleChange}
                        />
                    </div>
                    
                    <div className="pt-2">
                        <PrimaryButton type="submit" fullWidth>
                            Update Profile
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </PageTemplate>
    );
};

export default EditProfile;
