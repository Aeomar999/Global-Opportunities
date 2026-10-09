import { useState } from 'react';
import { Colors } from '../../constants/design';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, ChevronDown, ChevronLeft, Search, Upload, Check } from 'lucide-react-native';
import { authStore } from '../../constants/authStore';
import { profileStore } from '../../constants/mockProfile';
import { signupMobile, uploadFile } from '../../lib/api';
import { pickDocument, pickImage, PickedFile } from '../../lib/file-picker';
import { openPrivacyPolicy, openTermsOfService } from '../../lib/legal';

type Country = { name: string; code: string; dialCode: string };
type PickerType =
  | 'country' | 'university' | 'program' | 'year' | 'status'
  | 'skills' | 'interest' | 'prefCountries'
  | 'industry' | 'companySize' | 'positionRole'
  | null;

// ─── Data ─────────────────────────────────────────────────────────────────────

const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF', dialCode: '+93' },
  { name: 'Albania', code: 'AL', dialCode: '+355' },
  { name: 'Algeria', code: 'DZ', dialCode: '+213' },
  { name: 'Argentina', code: 'AR', dialCode: '+54' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'Austria', code: 'AT', dialCode: '+43' },
  { name: 'Bahamas', code: 'BS', dialCode: '+1-242' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880' },
  { name: 'Belgium', code: 'BE', dialCode: '+32' },
  { name: 'Brazil', code: 'BR', dialCode: '+55' },
  { name: 'Cambodia', code: 'KH', dialCode: '+855' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Chile', code: 'CL', dialCode: '+56' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Colombia', code: 'CO', dialCode: '+57' },
  { name: 'Denmark', code: 'DK', dialCode: '+45' },
  { name: 'Ecuador', code: 'EC', dialCode: '+593' },
  { name: 'Egypt', code: 'EG', dialCode: '+20' },
  { name: 'Ethiopia', code: 'ET', dialCode: '+251' },
  { name: 'Fiji', code: 'FJ', dialCode: '+679' },
  { name: 'Finland', code: 'FI', dialCode: '+358' },
  { name: 'France', code: 'FR', dialCode: '+33' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'Ghana', code: 'GH', dialCode: '+233' },
  { name: 'Greece', code: 'GR', dialCode: '+30' },
  { name: 'Haiti', code: 'HT', dialCode: '+509' },
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62' },
  { name: 'Ireland', code: 'IE', dialCode: '+353' },
  { name: 'Italy', code: 'IT', dialCode: '+39' },
  { name: 'Japan', code: 'JP', dialCode: '+81' },
  { name: 'Kenya', code: 'KE', dialCode: '+254' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60' },
  { name: 'Mexico', code: 'MX', dialCode: '+52' },
  { name: 'Morocco', code: 'MA', dialCode: '+212' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234' },
  { name: 'Norway', code: 'NO', dialCode: '+47' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92' },
  { name: 'Philippines', code: 'PH', dialCode: '+63' },
  { name: 'Poland', code: 'PL', dialCode: '+48' },
  { name: 'Portugal', code: 'PT', dialCode: '+351' },
  { name: 'Russia', code: 'RU', dialCode: '+7' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966' },
  { name: 'Senegal', code: 'SN', dialCode: '+221' },
  { name: 'Singapore', code: 'SG', dialCode: '+65' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27' },
  { name: 'South Korea', code: 'KR', dialCode: '+82' },
  { name: 'Spain', code: 'ES', dialCode: '+34' },
  { name: 'Sweden', code: 'SE', dialCode: '+46' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255' },
  { name: 'Thailand', code: 'TH', dialCode: '+66' },
  { name: 'Turkey', code: 'TR', dialCode: '+90' },
  { name: 'Uganda', code: 'UG', dialCode: '+256' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84' },
  { name: 'Zimbabwe', code: 'ZW', dialCode: '+263' },
];

const UNIVERSITIES = [
  'Ashe University', 'Cairo University', 'Cambridge University',
  'Columbia University', 'Harvard University', 'Johns Hopkins University',
  'Kwame Nkrumah University of Science and Technology',
  'London School of Economics', 'Maker University', 'MIT',
  'National University of Singapore', 'Oxford University', 'Princeton University',
  'Stanford University', 'University of Cape Town', 'University of Ghana',
  'University of Lagos', 'University of Nairobi', 'University of Sydney',
  'University of Toronto', 'Yale University',
];

const PROGRAMS = [
  'Accounting', 'Agriculture', 'Architecture', 'Business Administration',
  'Chemical Engineering', 'Civil Engineering', 'Computer Science', 'Data Science',
  'Economics', 'Education', 'Electrical Engineering', 'Environmental Science',
  'Finance', 'Information Technology', 'International Relations', 'Law',
  'Marketing', 'Mathematics', 'Mechanical Engineering', 'Medicine',
  'Nursing', 'Pharmacy', 'Psychology', 'Public Health', 'Software Engineering',
];

const GRADUATION_YEARS = [
  '2020', '2021', '2022', '2023', '2024',
  '2025', '2026', '2027', '2028', '2029', '2030',
];

const STATUSES = [
  'Undergraduate Student', 'Graduate Student', 'Recent Graduate',
  'Working Professional', 'Unemployed', 'Freelancer',
];

const SKILLS = [
  'Data Analysis', 'Project Management', 'Digital Marketing', 'Public Speaking',
  'Content Writing', 'Graphic Design', 'Financial Literacy', 'Critical Thinking',
  'Team Collaboration', 'Communication', 'Leadership', 'Problem Solving',
  'Time Management', 'Research & Analysis', 'Microsoft Excel',
  'Python Programming', 'JavaScript', 'SQL', 'UI/UX Design', 'Video Editing',
  'Negotiation', 'Customer Service', 'Event Planning', 'Fundraising',
];

const CAREER_INTERESTS = [
  'Software Engineering', 'Investment Banking', 'Public Health',
  'Agribusiness Management', 'Corporate Law', 'Human Resource Management',
  'Data Science', 'Supply Chain Logistics', 'Renewable Energy Engineering',
  'Architecture & Urban Planning', 'Education & Training', 'Medical Research',
  'International Development', 'Environmental Engineering', 'Entrepreneurship',
  'Digital Marketing', 'Finance & Accounting', 'Journalism & Media',
  'Public Policy', 'Social Work',
];

const INDUSTRIES = [
  'Technology', 'Education', 'Finance', 'Healthcare', 'Marketing',
  'Nonprofit/NGO', 'Government', 'Media', 'Agriculture', 'Other',
];

const COMPANY_SIZES = [
  '1–10 employees', '11–50 employees', '51–200 employees',
  '201–500 employees', '500–1,000 employees', '1,000+ employees',
];

const POSITION_ROLES = [
  'HR Manager', 'Recruiter', 'Talent Acquisition Specialist',
  'Hiring Manager', 'Program Coordinator', 'Founder/CEO',
  'Operations Manager', 'University Representative',
  'Internship Coordinator', 'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFlag = (code: string) =>
  code.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');

const LOGO_CLEARANCE = 114;

const MULTI_PICKERS: PickerType[] = ['skills', 'prefCountries'];
const isMulti = (t: PickerType) => MULTI_PICKERS.includes(t);

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

const LogoSVG = () => (
  <Image 
    source={require('../../../assets/images/logo.png')} 
    style={{ width: 56, height: 56, borderRadius: 28 }} 
    resizeMode="contain" 
  />
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const FieldLabel = ({ text, hint }: { text: string; hint?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
    <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500' }} className="font-sans">
      {text}
    </Text>
    {hint && (
      <Text style={{ fontSize: 12, color: '#A1A1AA' }} className="font-sans">
        {hint}
      </Text>
    )}
  </View>
);

const DropdownField = ({
  value, placeholder, onPress,
}: {
  value: string; placeholder: string; onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12,
      paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', backgroundColor: '#FFFFFF', marginBottom: 20,
    }}
  >
    <Text style={{ fontSize: 14, color: value ? '#1A1A1A' : '#A1A1AA' }} className="font-sans">
      {value || placeholder}
    </Text>
    <ChevronDown size={18} color="#A1A1AA" />
  </TouchableOpacity>
);

// Chip tag for multi-select values displayed in the field
const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <View
    style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(121, 46, 164, 0.12)',
      borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, gap: 6,
    }}
  >
    <Text style={{ fontSize: 12, color: Colors.primary }} className="font-sans">{label}</Text>
    <TouchableOpacity
      onPress={onRemove}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View
        style={{
          width: 16, height: 16, borderRadius: 8,
          borderWidth: 1.2, borderColor: Colors.primary,
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 8, color: Colors.primary, lineHeight: 12, marginTop: 1 }}>✕</Text>
      </View>
    </TouchableOpacity>
  </View>
);

// Multi-select field that shows chips of selected values
const MultiField = ({
  values, placeholder, onPress, onRemove,
}: {
  values: string[]; placeholder: string; onPress: () => void; onRemove: (v: string) => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={{
      borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12,
      paddingHorizontal: 16, paddingRight: 44,
      minHeight: 52, justifyContent: 'center',
      backgroundColor: '#FFFFFF', marginBottom: 20,
      position: 'relative',
    }}
  >
    {values.length === 0 ? (
      <Text style={{ fontSize: 14, color: '#A1A1AA', paddingVertical: 15 }} className="font-sans">
        {placeholder}
      </Text>
    ) : (
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 }}
      >
        {values.map(v => (
          <Chip key={v} label={v} onRemove={() => onRemove(v)} />
        ))}
      </View>
    )}
    <View style={{ position: 'absolute', right: 16, top: 17 }}>
      <ChevronDown size={18} color="#A1A1AA" />
    </View>
  </TouchableOpacity>
);

// Card component for uploading files and images in Hirer flow
const UploadCard = ({
  status,
  onPress,
  typesHint,
  isImage = false,
  fileName,
}: {
  status: 'idle' | 'loading' | 'done';
  onPress: () => void;
  typesHint: string;
  isImage?: boolean;
  fileName?: string;
}) => {
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: '#D0D0D8',
        borderStyle: 'dashed',
        borderRadius: 12,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        gap: 6,
        marginBottom: 16,
        paddingHorizontal: 16,
      }}
    >
      {status === 'idle' && (
        <>
          <Upload size={24} color="#A1A1AA" />
          <Text style={{ fontSize: 13, color: '#A1A1AA', textAlign: 'center', marginTop: 2 }} className="font-sans">
            Choose {isImage ? 'an image' : 'a file'} or drag & drop it here
          </Text>
          <Text style={{ fontSize: 12, color: '#C0C0C8', marginBottom: 8 }} className="font-sans">
            {typesHint}
          </Text>
          <TouchableOpacity
            onPress={onPress}
            style={{
              borderWidth: 1, borderColor: '#C0C0C8', borderRadius: 8,
              paddingHorizontal: 16, paddingVertical: 6,
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text style={{ fontSize: 12, color: '#595959', fontWeight: '500' }} className="font-sans">Browse files</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'loading' && (
        <>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 6 }} className="font-sans">
            uploading document...
          </Text>
        </>
      )}

      {status === 'done' && (
        <>
          <View
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: Colors.primary,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text
            style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '600', marginTop: 4, textAlign: 'center' }}
            numberOfLines={1}
            className="font-sans"
          >
            {fileName || 'Uploaded'}
          </Text>
          <TouchableOpacity onPress={onPress} style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: '#6671E4', fontWeight: '500' }} className="font-sans">Change file</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

// ─── Role card ───────────────────────────────────────────────────────────────

// Module level so it is not re-created (and remounted) on every SignupScreen render.
const RoleCard = ({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) => (
  <TouchableOpacity
    onPress={onSelect}
    style={{
      flex: 1, borderWidth: 1.5,
      borderColor: active ? Colors.primary : '#EBEBEE',
      borderRadius: 12, padding: 14, backgroundColor: '#FFFFFF',
    }}
  >
    <View
      style={{
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 2, borderColor: active ? Colors.primary : '#C4C4C4',
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
      }}
    >
      {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }} />}
    </View>
    <Text
      style={{ fontSize: 13, fontWeight: '600', color: active ? Colors.primary : '#8A8D9F', lineHeight: 18 }}
      className="font-sans"
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function SignupScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight - LOGO_CLEARANCE;

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'seeker' | 'hirer'>('seeker');

  const totalSteps = role === 'seeker' ? 4 : 3;

  // Step 1 (seeker)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState('');

  // Step 2 (seeker)
  const [university, setUniversity] = useState('');
  const [program, setProgram] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');

  // Step 3 (seeker)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [careerInterest, setCareerInterest] = useState('');
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);

  // Step 4 (seeker)
  const [cvStatus, setCvStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [cvFile, setCvFile] = useState<PickedFile | null>(null);

  // Hirer Step 1 (Company Details)
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedCompanySize, setSelectedCompanySize] = useState('');
  const [selectedCompanyCountry, setSelectedCompanyCountry] = useState<Country | null>(null);

  // Hirer Step 2 (Recruiter Details)
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterPosition, setRecruiterPosition] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [recruiterPhone, setRecruiterPhone] = useState('');
  const [recruiterLinkedin, setRecruiterLinkedin] = useState('');
  const [recruiterPassword, setRecruiterPassword] = useState('');
  const [showRecruiterPassword, setShowRecruiterPassword] = useState(false);

  // Hirer Step 3 (Verification Documents)
  const [docBusinessRegStatus, setDocBusinessRegStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [docBusinessRegFile, setDocBusinessRegFile] = useState<PickedFile | null>(null);
  const [docOrgIdStatus, setDocOrgIdStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [docOrgIdFile, setDocOrgIdFile] = useState<PickedFile | null>(null);
  const [docCompanyLogoStatus, setDocCompanyLogoStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [docCompanyLogoFile, setDocCompanyLogoFile] = useState<PickedFile | null>(null);
  const [docProofOfOrgStatus, setDocProofOfOrgStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [docProofOfOrgFile, setDocProofOfOrgFile] = useState<PickedFile | null>(null);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker sheet
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerAnim] = useState(() => new Animated.Value(windowHeight));

  const openPicker = (type: PickerType) => {
    setActivePicker(type);
    setSearchQuery('');
    Animated.spring(pickerAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  };

  const closePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: sheetHeight, duration: 240, useNativeDriver: true,
    }).start(() => setActivePicker(null));
  };

  const handlePickerSelect = (item: Country | string) => {
    if (activePicker === 'country') {
      const c = item as Country;
      if (role === 'seeker') {
        setSelectedCountry(c);
        setPhone(`(${c.dialCode}) `);
      } else {
        setSelectedCompanyCountry(c);
        setRecruiterPhone(`(${c.dialCode}) `);
      }
      closePicker();
    } else if (activePicker === 'university') {
      setUniversity(item as string); closePicker();
    } else if (activePicker === 'program') {
      setProgram(item as string); closePicker();
    } else if (activePicker === 'year') {
      setGraduationYear(item as string); closePicker();
    } else if (activePicker === 'status') {
      setCurrentStatus(item as string); closePicker();
    } else if (activePicker === 'interest') {
      setCareerInterest(item as string); closePicker();
    } else if (activePicker === 'skills') {
      const s = item as string;
      setSelectedSkills(prev =>
        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
      );
    } else if (activePicker === 'prefCountries') {
      const name = (item as Country).name;
      setPreferredCountries(prev =>
        prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
      );
    } else if (activePicker === 'industry') {
      setSelectedIndustry(item as string); closePicker();
    } else if (activePicker === 'companySize') {
      setSelectedCompanySize(item as string); closePicker();
    } else if (activePicker === 'positionRole') {
      setRecruiterPosition(item as string); closePicker();
    }
  };

  const getPickerItems = (): (Country | string)[] => {
    const q = searchQuery.toLowerCase();
    switch (activePicker) {
      case 'country':
      case 'prefCountries':
        return COUNTRIES.filter(c => c.name.toLowerCase().includes(q));
      case 'university':  return UNIVERSITIES.filter(u => u.toLowerCase().includes(q));
      case 'program':     return PROGRAMS.filter(p => p.toLowerCase().includes(q));
      case 'year':        return GRADUATION_YEARS;
      case 'status':      return STATUSES;
      case 'skills':      return SKILLS.filter(s => s.toLowerCase().includes(q));
      case 'interest':    return CAREER_INTERESTS.filter(i => i.toLowerCase().includes(q));
      case 'industry':    return INDUSTRIES.filter(i => i.toLowerCase().includes(q));
      case 'companySize': return COMPANY_SIZES;
      case 'positionRole': return POSITION_ROLES.filter(p => p.toLowerCase().includes(q));
      default:            return [];
    }
  };

  const pickerMeta: Record<string, { title: string; subtitle: string; searchPlaceholder?: string }> = {
    country:       { title: 'Select your country',          subtitle: 'Please select your country to proceed.',        searchPlaceholder: 'Search country' },
    university:    { title: 'Select your university',       subtitle: 'Please select your university.',                searchPlaceholder: 'Search university' },
    program:       { title: 'Select your program',          subtitle: 'Please select your program.',                   searchPlaceholder: 'Search program' },
    year:          { title: 'Select graduation year',       subtitle: 'Please select your graduation year.' },
    status:        { title: 'Select your current status',   subtitle: 'Please select your current status.' },
    skills:        { title: 'Select your Skills',           subtitle: 'You can select more than one option.',          searchPlaceholder: 'Search skills' },
    interest:      { title: 'Select your Interest',         subtitle: 'Please select your career interest to proceed.', searchPlaceholder: 'Search for your career interest' },
    prefCountries: { title: 'Select your preferred countries', subtitle: 'You can select more than one option.',       searchPlaceholder: 'Search country' },
    industry:      { title: 'Select your industry',         subtitle: 'Please select your industry to proceed.',        searchPlaceholder: 'Search for your industry' },
    companySize:   { title: 'Select your company size',     subtitle: 'Please select your company size to proceed.' },
    positionRole:  { title: 'Select your position/role',    subtitle: 'Please select your position/role to proceed.' },
  };

  const currentMeta = activePicker ? pickerMeta[activePicker] : null;
  const showSearch = activePicker !== 'year' && activePicker !== 'status' && activePicker !== 'companySize' && activePicker !== 'positionRole';

  const isItemSelected = (item: Country | string): boolean => {
    if (activePicker === 'country') {
      return role === 'seeker'
        ? selectedCountry?.code === (item as Country).code
        : selectedCompanyCountry?.code === (item as Country).code;
    }
    if (activePicker === 'prefCountries') return preferredCountries.includes((item as Country).name);
    if (activePicker === 'university')    return university === (item as string);
    if (activePicker === 'program')       return program === (item as string);
    if (activePicker === 'year')          return graduationYear === (item as string);
    if (activePicker === 'status')        return currentStatus === (item as string);
    if (activePicker === 'skills')        return selectedSkills.includes(item as string);
    if (activePicker === 'interest')      return careerInterest === (item as string);
    if (activePicker === 'industry')      return selectedIndustry === (item as string);
    if (activePicker === 'companySize')   return selectedCompanySize === (item as string);
    if (activePicker === 'positionRole')  return recruiterPosition === (item as string);
    return false;
  };

  const isCountryType = activePicker === 'country' || activePicker === 'prefCountries';

  // Validation logic
  const isStepValid = () => {
    if (role === 'seeker') {
      if (step === 1) return !!(fullName.trim() && email.trim() && password.trim() && selectedCountry && phone.trim().length > 4);
      if (step === 2) return !!(university && program && graduationYear && currentStatus);
      if (step === 3) return !!(selectedSkills.length > 0 && careerInterest && preferredCountries.length > 0);
      if (step === 4) return cvStatus === 'done';
    } else {
      if (step === 1) return !!(companyName.trim() && companyEmail.trim() && companyWebsite.trim() && selectedIndustry && selectedCompanySize && selectedCompanyCountry);
      if (step === 2) return !!(recruiterName.trim() && recruiterPosition && recruiterEmail.trim() && recruiterPhone.trim().length > 4 && recruiterLinkedin.trim() && recruiterPassword.trim());
      if (step === 3) return docBusinessRegStatus === 'done' && docOrgIdStatus === 'done' && docCompanyLogoStatus === 'done' && docProofOfOrgStatus === 'done';
    }
    return false;
  };
  const isNextActive = isStepValid();

  // Document upload handler for Hirer
  const handleDocUpload = async (docType: 'businessReg' | 'orgId' | 'companyLogo' | 'proofOfOrg') => {
    try {
      setAuthError('');
      if (docType === 'companyLogo') {
        const file = await pickImage({ allowsEditing: true, aspect: [1, 1] });
        if (!file) return;
        setDocCompanyLogoFile(file);
        setDocCompanyLogoStatus('loading');
        setTimeout(() => setDocCompanyLogoStatus('done'), 500);
      } else {
        const file = await pickDocument();
        if (!file) return;
        if (docType === 'businessReg') {
          setDocBusinessRegFile(file);
          setDocBusinessRegStatus('loading');
          setTimeout(() => setDocBusinessRegStatus('done'), 500);
        } else if (docType === 'orgId') {
          setDocOrgIdFile(file);
          setDocOrgIdStatus('loading');
          setTimeout(() => setDocOrgIdStatus('done'), 500);
        } else if (docType === 'proofOfOrg') {
          setDocProofOfOrgFile(file);
          setDocProofOfOrgStatus('loading');
          setTimeout(() => setDocProofOfOrgStatus('done'), 500);
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to select document');
    }
  };

  // CV file picker (cross-platform: native iOS/Android + Web)
  const handleBrowseFiles = async () => {
    try {
      setAuthError('');
      const file = await pickDocument();
      if (!file) return;
      setCvFile(file);
      setCvStatus('loading');
      setTimeout(() => setCvStatus('done'), 500);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to select CV');
    }
  };

  const handleCreateAccount = async () => {
    setAuthError('');
    setIsSubmitting(true);

    try {
      const session =
        role === 'hirer'
          ? await signupMobile({
              name: recruiterName.trim(),
              email: recruiterEmail.trim(),
              password: recruiterPassword,
              role: 'hirer',
              companyName: companyName.trim(),
              industry: selectedIndustry,
              location: selectedCompanyCountry?.name ?? '',
              website: companyWebsite.trim(),
              companySize: selectedCompanySize,
              companyEmail: companyEmail.trim(),
              recruiterRole: recruiterPosition,
              recruiterPhone,
              recruiterLinkedin,
            })
          : await signupMobile({
              name: fullName.trim(),
              email: email.trim(),
              password,
              role: 'seeker',
              profession: careerInterest || 'Opportunity Seeker',
              university,
              country: selectedCountry?.name ?? '',
              city: selectedCountry?.name ?? '',
              phone,
              technicalSkills: selectedSkills,
            });

      authStore.setSession(session.token, session.user);
      authStore.setRole(role);

      if (role === 'hirer') {
        let uploadedLogoUrl = docCompanyLogoFile?.uri || '';
        if (docCompanyLogoFile) {
          try {
            const uploaded = await uploadFile(docCompanyLogoFile, 'company-logos');
            if (uploaded?.url) uploadedLogoUrl = uploaded.url;
          } catch (uploadErr) {
            console.warn('Could not upload company logo:', uploadErr);
          }
        }

        authStore.updateCompany({
          name: companyName,
          companyEmail,
          website: companyWebsite,
          industry: selectedIndustry,
          companySize: selectedCompanySize,
          location: selectedCompanyCountry?.name ?? '',
          logo: uploadedLogoUrl,
          recruiterName,
          recruiterRole: recruiterPosition,
          recruiterEmail,
          recruiterPhone,
          recruiterLinkedin,
        });
        authStore.updateVerificationDoc('businessReg', docBusinessRegStatus);
        authStore.updateVerificationDoc('orgId', docOrgIdStatus);
        authStore.updateVerificationDoc('companyLogo', docCompanyLogoStatus);
        authStore.updateVerificationDoc('proofOfOrg', docProofOfOrgStatus);
      } else {
        let resumeUrl = cvFile?.name || '';
        if (cvFile) {
          try {
            const uploaded = await uploadFile(cvFile, 'cvs');
            if (uploaded?.url) resumeUrl = uploaded.url;
          } catch (uploadErr) {
            console.warn('Could not upload CV file:', uploadErr);
          }
        }

        profileStore.updateProfile({
          name: fullName,
          email,
          phone,
          location: selectedCountry?.name ?? '',
          country: selectedCountry?.name ?? '',
          profession: careerInterest,
          technicalSkills: selectedSkills,
          education: [
            { degree: program, institution: university, duration: graduationYear },
          ],
          resumeUrl,
        });
      }

      router.replace('/(auth)/loading');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>


      {/* Progress bar */}
      <View style={{ height: 4, backgroundColor: '#E5E6F2' }}>
        <View
          style={{
            height: 4,
            width: `${(step / totalSteps) * 100}%`,
            backgroundColor: Colors.primary, borderRadius: 2,
          }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!activePicker}
        >
          {/* Logo */}
          <View style={{ marginBottom: 16 }}>
            <LogoSVG />
          </View>

          {/* Header */}
          <Text
            style={{ fontSize: 22, color: Colors.primary, fontWeight: 'bold', fontStyle: 'italic', marginBottom: 6 }}
            className="font-sans"
          >
            Welcome
          </Text>
          <Text
            style={{ fontSize: 13, color: '#8A8D9F', lineHeight: 20, marginBottom: 24 }}
            className="font-sans"
          >
            Explore global opportunities or find talented candidates, post opportunities, and connect with skilled youth.{' '}
            <Text
              style={{ color: Colors.primary, fontWeight: 'bold' }}
              onPress={() => router.replace('/(auth)/login')}
            >
              Go back to login
            </Text>
          </Text>

          {/* Role selector */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <RoleCard label={`Looking for\nOpportunities`} active={role === 'seeker'} onSelect={() => { setRole('seeker'); setStep(1); }} />
            <RoleCard label="Hiring Talent" active={role === 'hirer'} onSelect={() => { setRole('hirer'); setStep(1); }} />
          </View>

          {/* ── Step 1: Personal info (Seeker) ── */}
          {step === 1 && role === 'seeker' && (
            <>
              <FieldLabel text="Full Name" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={fullName} onChangeText={setFullName}
                  placeholder="Enter your full name" placeholderTextColor="#A1A1AA"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Email" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={email} onChangeText={setEmail}
                  placeholder="Enter your email address" placeholderTextColor="#A1A1AA"
                  keyboardType="email-address" autoCapitalize="none"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Password" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={password} onChangeText={setPassword}
                  placeholder="Enter your password" placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showPassword}
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                  {showPassword ? <EyeOff size={18} color="#A1A1AA" /> : <Eye size={18} color="#A1A1AA" />}
                </TouchableOpacity>
              </View>

              <FieldLabel text="Country" />
              <DropdownField value={selectedCountry?.name ?? ''} placeholder="Select your country" onPress={() => openPicker('country')} />

              <FieldLabel text="Phone Number" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={phone} onChangeText={setPhone}
                  placeholder="Enter your phone number" placeholderTextColor="#A1A1AA"
                  keyboardType="phone-pad"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>
            </>
          )}

          {/* ── Step 1: Company details (Hirer) ── */}
          {step === 1 && role === 'hirer' && (
            <>
              <FieldLabel text="Company/Organization Name" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={companyName} onChangeText={setCompanyName}
                  placeholder="Enter company name" placeholderTextColor="#A1A1AA"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Company Email" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={companyEmail} onChangeText={setCompanyEmail}
                  placeholder="Enter company email address" placeholderTextColor="#A1A1AA"
                  keyboardType="email-address" autoCapitalize="none"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Company Website" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={companyWebsite} onChangeText={setCompanyWebsite}
                  placeholder="Enter company website link" placeholderTextColor="#A1A1AA"
                  autoCapitalize="none"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Industry" />
              <DropdownField value={selectedIndustry} placeholder="Select your industry" onPress={() => openPicker('industry')} />

              <FieldLabel text="Company Size" />
              <DropdownField value={selectedCompanySize} placeholder="Select your company size" onPress={() => openPicker('companySize')} />

              <FieldLabel text="Country" />
              <DropdownField value={selectedCompanyCountry?.name ?? ''} placeholder="Select your country" onPress={() => openPicker('country')} />
            </>
          )}

          {/* ── Step 2: Academic info (Seeker) ── */}
          {step === 2 && role === 'seeker' && (
            <>
              <FieldLabel text="University" />
              <DropdownField value={university} placeholder="Select your university" onPress={() => openPicker('university')} />

              <FieldLabel text="Program" />
              <DropdownField value={program} placeholder="Select your program" onPress={() => openPicker('program')} />

              <FieldLabel text="Graduation Year" />
              <DropdownField value={graduationYear} placeholder="Select your graduation year" onPress={() => openPicker('year')} />

              <FieldLabel text="Current Status" />
              <DropdownField value={currentStatus} placeholder="Select your current status" onPress={() => openPicker('status')} />
            </>
          )}

          {/* ── Step 2: Recruiter details (Hirer) ── */}
          {step === 2 && role === 'hirer' && (
            <>
              <FieldLabel text="Full Name" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={recruiterName} onChangeText={setRecruiterName}
                  placeholder="Enter your full name" placeholderTextColor="#A1A1AA"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Position/Role" />
              <DropdownField value={recruiterPosition} placeholder="Select your position/role" onPress={() => openPicker('positionRole')} />

              <FieldLabel text="Work Email" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={recruiterEmail} onChangeText={setRecruiterEmail}
                  placeholder="Enter your official company email address" placeholderTextColor="#A1A1AA"
                  keyboardType="email-address" autoCapitalize="none"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Phone Number" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={recruiterPhone} onChangeText={setRecruiterPhone}
                  placeholder="Enter your phone number" placeholderTextColor="#A1A1AA"
                  keyboardType="phone-pad"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="LinkedIn Profile" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={recruiterLinkedin} onChangeText={setRecruiterLinkedin}
                  placeholder="Enter your linkedin profile link" placeholderTextColor="#A1A1AA"
                  autoCapitalize="none"
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              <FieldLabel text="Password" />
              <View style={{ height: 52, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 20 }}>
                <TextInput
                  value={recruiterPassword} onChangeText={setRecruiterPassword}
                  placeholder="Enter your password" placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showRecruiterPassword}
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
                <TouchableOpacity onPress={() => setShowRecruiterPassword(v => !v)} style={{ padding: 4 }}>
                  {showRecruiterPassword ? <EyeOff size={18} color="#A1A1AA" /> : <Eye size={18} color="#A1A1AA" />}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 3: Skills + Interests + Preferred Countries (Seeker) ── */}
          {step === 3 && role === 'seeker' && (
            <>
              <FieldLabel text="Skills" hint="(select both your technical and soft skills)" />
              <MultiField
                values={selectedSkills}
                placeholder="Select your skills"
                onPress={() => openPicker('skills')}
                onRemove={s => setSelectedSkills(prev => prev.filter(x => x !== s))}
              />

              <FieldLabel text="Career Interest" />
              <DropdownField value={careerInterest} placeholder="Select your career interests" onPress={() => openPicker('interest')} />

              <FieldLabel text="Preferred Countries" />
              <MultiField
                values={preferredCountries}
                placeholder="Select your preferred countries"
                onPress={() => openPicker('prefCountries')}
                onRemove={c => setPreferredCountries(prev => prev.filter(x => x !== c))}
              />
            </>
          )}

          {/* ── Step 3: Verification Documents (Hirer) ── */}
          {step === 3 && role === 'hirer' && (
            <View style={{ gap: 20 }}>
              <View>
                <FieldLabel text="Business Registration Document" />
                <UploadCard
                  status={docBusinessRegStatus}
                  onPress={() => handleDocUpload('businessReg')}
                  fileName={docBusinessRegFile?.name}
                  typesHint="txt, docx, pdf - Up to 5MB"
                />
              </View>

              <View>
                <FieldLabel text="Organization ID" />
                <UploadCard
                  status={docOrgIdStatus}
                  onPress={() => handleDocUpload('orgId')}
                  fileName={docOrgIdFile?.name}
                  typesHint="txt, docx, pdf - Up to 5MB"
                />
              </View>

              <View>
                <FieldLabel text="Company Logo" />
                <UploadCard
                  status={docCompanyLogoStatus}
                  onPress={() => handleDocUpload('companyLogo')}
                  fileName={docCompanyLogoFile?.name}
                  typesHint="jpg, png, svg - Up to 5MB"
                  isImage
                />
              </View>

              <View>
                <FieldLabel text="Official Proof of Organization" />
                <UploadCard
                  status={docProofOfOrgStatus}
                  onPress={() => handleDocUpload('proofOfOrg')}
                  fileName={docProofOfOrgFile?.name}
                  typesHint="txt, docx, pdf - Up to 5MB"
                />
                <Text style={{ fontSize: 12, color: '#DC2626', marginTop: -10, marginBottom: 10, lineHeight: 16 }} className="font-sans">
                  ⓘ Example of Official Proof of Organization are: tax certificate, NGO registration, company license
                </Text>
              </View>
            </View>
          )}

          {/* ── Step 4: CV/Resume Upload (Seeker) ── */}
          {step === 4 && role === 'seeker' && (
            <>
              <FieldLabel text="Upload CV/Resume" />
              <View
                style={{
                  borderWidth: 1.5,
                  borderColor: '#D0D0D8',
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  height: 200,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#F5F6FA',
                  gap: 8,
                  paddingHorizontal: 16,
                }}
              >
                {cvStatus === 'idle' && (
                  <>
                    <Upload size={32} color="#A1A1AA" />
                    <Text style={{ fontSize: 13, color: '#A1A1AA', textAlign: 'center', marginTop: 4 }} className="font-sans">
                      Choose a file or drag & drop it here
                    </Text>
                    <Text style={{ fontSize: 12, color: '#C0C0C8', marginBottom: 12 }} className="font-sans">
                      txt, docx, pdf - Up to 5MB
                    </Text>
                    <TouchableOpacity
                      onPress={handleBrowseFiles}
                      style={{
                        borderWidth: 1, borderColor: '#C0C0C8', borderRadius: 8,
                        paddingHorizontal: 20, paddingVertical: 8,
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#595959' }} className="font-sans">Browse files</Text>
                    </TouchableOpacity>
                  </>
                )}

                {cvStatus === 'loading' && (
                  <>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ fontSize: 13, color: '#8A8D9F', marginTop: 8 }} className="font-sans">
                      extracting information 🔥
                    </Text>
                  </>
                )}

                {cvStatus === 'done' && (
                  <>
                    <View
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: Colors.primary,
                        justifyContent: 'center', alignItems: 'center',
                      }}
                    >
                      <Check size={22} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <Text
                      style={{ fontSize: 14, color: '#1A1A1A', fontWeight: '600', marginTop: 4, textAlign: 'center', paddingHorizontal: 16 }}
                      numberOfLines={1}
                      className="font-sans"
                    >
                      {cvFile?.name || 'Resume Attached'}
                    </Text>
                    <TouchableOpacity onPress={handleBrowseFiles} style={{ marginTop: 2 }}>
                      <Text style={{ fontSize: 12, color: '#6671E4', fontWeight: '500' }} className="font-sans">Change file</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {authError ? (
        <Text style={{ paddingHorizontal: 24, color: '#ED4C5C', fontSize: 13 }} className="font-sans">
          {authError}
        </Text>
      ) : null}

      {/* Legal Compliance Notice (Apple App Store Guideline 5.1.1 & Google Play) */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 8, alignItems: 'center', backgroundColor: '#F7F7F9' }}>
        <Text style={{ fontSize: 11, color: '#8A8D9F', textAlign: 'center', lineHeight: 16 }} className="font-sans">
          By creating an account, you agree to Kredibble&apos;s{' '}
          <Text onPress={openTermsOfService} style={{ color: '#6671E4', fontWeight: '600', textDecorationLine: 'underline' }}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text onPress={openPrivacyPolicy} style={{ color: '#6671E4', fontWeight: '600', textDecorationLine: 'underline' }}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      {/* Fixed bottom buttons */}
      <View
        style={{
          paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12,
          flexDirection: 'row', gap: 12, backgroundColor: '#F7F7F9',
        }}
      >
        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep(s => s - 1)}
            style={{
              width: 52, height: 52, borderWidth: 1.5, borderColor: Colors.primary,
              borderRadius: 12, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          disabled={!isNextActive || isSubmitting}
          onPress={async () => {
            if (step < totalSteps) {
              setStep(s => s + 1);
              return;
            }

            await handleCreateAccount();
          }}
          style={{
            flex: 1, height: 52, borderRadius: 12,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: isNextActive && !isSubmitting ? Colors.primary : Colors.purple200,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">
            {isSubmitting ? 'Creating account...' : step === totalSteps ? 'Done' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Picker bottom sheet ── */}
      {activePicker && (
        <>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }}
            activeOpacity={1}
            onPress={closePicker}
          />

          <Animated.View
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: sheetHeight, backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              paddingTop: 12,
              transform: [{ translateY: pickerAnim }],
              flexDirection: 'column',
            }}
          >
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

            {/* Title + subtitle */}
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', fontStyle: 'italic', color: Colors.primary, marginBottom: 4 }} className="font-sans">
                {currentMeta?.title}
              </Text>
              <Text style={{ fontSize: 12, color: '#8A8D9F' }} className="font-sans">
                {currentMeta?.subtitle}
              </Text>
            </View>

            {/* Search */}
            {showSearch && (
              <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
                <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', gap: 10 }}>
                  <Search size={16} color="#A1A1AA" />
                  <TextInput
                    value={searchQuery} onChangeText={setSearchQuery}
                    placeholder={currentMeta?.searchPlaceholder ?? 'Search...'}
                    placeholderTextColor="#A1A1AA"
                    style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                </View>
              </View>
            )}

            {/* Items list */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {getPickerItems().map((item, i) => {
                const label = isCountryType ? (item as Country).name : (item as string);
                const selected = isItemSelected(item);

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handlePickerSelect(item)}
                    style={{
                      height: 56, borderWidth: 1,
                      borderColor: selected ? Colors.primary : '#EBEBEE',
                      borderRadius: 12, paddingHorizontal: 16,
                      flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'space-between', backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: selected ? Colors.primary : '#1A1A1A', flex: 1 }} className="font-sans">
                      {label}
                    </Text>
                    {isCountryType && (
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F6FA', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                        <Text style={{ fontSize: 20 }}>{getFlag((item as Country).code)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Done button for multi-select pickers */}
            {isMulti(activePicker) && (
              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
                <TouchableOpacity
                  onPress={closePicker}
                  style={{
                    height: 52, borderRadius: 12, backgroundColor: Colors.primary,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}
