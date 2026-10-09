import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, X, Trash2 } from 'lucide-react-native';
import { profileStore } from '../../constants/mockProfile';
import { authStore } from '../../constants/authStore';
import { updateSeekerProfile } from '../../lib/api';

const ALL_AVAILABLE_SKILLS = [
  'HTML5', 'CSS3', 'JavaScript', 'React', 'Bootstrap', 'Figma', 'TypeScript', 
  'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'AWS', 'Python',
  'Problem Solving', 'Team Collaboration', 'Communication', 'Creativity', 
  'Attention to Detail', 'Time Management', 'Critical Thinking', 'User Empathy',
  'Analytical Thinking', 'Risk Management'
];

const ALL_AVAILABLE_TOOLS = [
  'Figma', 'VS Code', 'GitHub', 'Notion', 'Postman', 'Wireshark', 'Metasploit', 
  'Nmap', 'Burp Suite', 'Slack', 'Adobe Creative Cloud', 'Miro', 'Jira'
];

export default function EditProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState({ ...profileStore.user });
  
  // Local state for dropdown adders
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [toolModalVisible, setToolModalVisible] = useState(false);

  const handleSave = async () => {
    try {
      const seekerId = (authStore as any).user?.seeker?.id;
      if (seekerId) {
        await updateSeekerProfile(seekerId, user);
      }
      
      profileStore.updateProfile(user);
      router.replace('/profile/manage');
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile');
      console.error(err);
    }
  };

  const updateField = (key: string, value: any) => {
    setUser(prev => ({ ...prev, [key]: value }));
  };

  // Skill Add/Remove
  const removeSkill = (skillToRemove: string, isTechnical: boolean) => {
    if (isTechnical) {
      setUser(prev => ({
        ...prev,
        technicalSkills: prev.technicalSkills.filter(s => s !== skillToRemove)
      }));
    } else {
      setUser(prev => ({
        ...prev,
        softSkills: prev.softSkills.filter(s => s !== skillToRemove)
      }));
    }
  };

  const addSkill = (skill: string) => {
    // Detect if technical or soft based on list type (mock heuristic)
    const isTech = [
      'HTML5', 'CSS3', 'JavaScript', 'React', 'Bootstrap', 'Figma', 'TypeScript', 
      'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'Docker', 'AWS', 'Python'
    ].includes(skill);

    if (isTech) {
      if (!user.technicalSkills.includes(skill)) {
        setUser(prev => ({
          ...prev,
          technicalSkills: [...prev.technicalSkills, skill]
        }));
      }
    } else {
      if (!user.softSkills.includes(skill)) {
        setUser(prev => ({
          ...prev,
          softSkills: [...prev.softSkills, skill]
        }));
      }
    }
    setSkillModalVisible(false);
  };

  // Tool Add/Remove
  const removeTool = (toolToRemove: string) => {
    setUser(prev => ({
      ...prev,
      tools: prev.tools.filter(t => t !== toolToRemove)
    }));
  };

  const addTool = (tool: string) => {
    if (!user.tools.includes(tool)) {
      setUser(prev => ({
        ...prev,
        tools: [...prev.tools, tool]
      }));
    }
    setToolModalVisible(false);
  };

  // Work Experience Helpers
  const addWorkExperience = () => {
    setUser(prev => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        { role: '', company: '', location: '', duration: '', bullets: [''] }
      ]
    }));
  };

  const removeWorkExperience = (index: number) => {
    setUser(prev => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index)
    }));
  };

  const updateWorkExperience = (index: number, key: string, value: any) => {
    const list = [...user.workExperience];
    list[index] = { ...list[index], [key]: value };
    setUser(prev => ({ ...prev, workExperience: list }));
  };

  const addExperienceBullet = (expIndex: number) => {
    const list = [...user.workExperience];
    list[expIndex].bullets.push('');
    setUser(prev => ({ ...prev, workExperience: list }));
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, text: string) => {
    const list = [...user.workExperience];
    list[expIndex].bullets[bulletIndex] = text;
    setUser(prev => ({ ...prev, workExperience: list }));
  };

  const removeExperienceBullet = (expIndex: number, bulletIndex: number) => {
    const list = [...user.workExperience];
    list[expIndex].bullets = list[expIndex].bullets.filter((_, i) => i !== bulletIndex);
    setUser(prev => ({ ...prev, workExperience: list }));
  };

  // Education Helpers
  const addEducation = () => {
    setUser(prev => ({
      ...prev,
      education: [...prev.education, { degree: '', institution: '', duration: '' }]
    }));
  };

  const removeEducation = (index: number) => {
    setUser(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const updateEducation = (index: number, key: string, value: any) => {
    const list = [...user.education];
    list[index] = { ...list[index], [key]: value };
    setUser(prev => ({ ...prev, education: list }));
  };

  // Projects Helpers
  const addProject = () => {
    setUser(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', bullets: [''] }]
    }));
  };

  const removeProject = (index: number) => {
    setUser(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }));
  };

  const updateProject = (index: number, key: string, value: any) => {
    const list = [...user.projects];
    list[index] = { ...list[index], [key]: value };
    setUser(prev => ({ ...prev, projects: list }));
  };

  const addProjectBullet = (projIndex: number) => {
    const list = [...user.projects];
    list[projIndex].bullets.push('');
    setUser(prev => ({ ...prev, projects: list }));
  };

  const updateProjectBullet = (projIndex: number, bulletIndex: number, text: string) => {
    const list = [...user.projects];
    list[projIndex].bullets[bulletIndex] = text;
    setUser(prev => ({ ...prev, projects: list }));
  };

  const removeProjectBullet = (projIndex: number, bulletIndex: number) => {
    const list = [...user.projects];
    list[projIndex].bullets = list[projIndex].bullets.filter((_, i) => i !== bulletIndex);
    setUser(prev => ({ ...prev, projects: list }));
  };

  // Certifications Helpers
  const addCertification = () => {
    setUser(prev => ({
      ...prev,
      certifications: [...prev.certifications, '']
    }));
  };

  const removeCertification = (index: number) => {
    setUser(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  const updateCertification = (index: number, text: string) => {
    const list = [...user.certifications];
    list[index] = text;
    setUser(prev => ({ ...prev, certifications: list }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Edit profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Basic Fields */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Full name*</Text>
          <TextInput 
            style={styles.input} 
            value={user.name} 
            onChangeText={(txt) => updateField('name', txt)}
            className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Email address*</Text>
          <TextInput 
            style={styles.input} 
            value={user.email} 
            onChangeText={(txt) => updateField('email', txt)}
            keyboardType="email-address"
            className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Phone number*</Text>
          <TextInput 
            style={styles.input} 
            value={user.phone} 
            onChangeText={(txt) => updateField('phone', txt)}
            keyboardType="phone-pad"
            className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Profession*</Text>
          <TextInput 
            style={styles.input} 
            value={user.profession} 
            onChangeText={(txt) => updateField('profession', txt)}
            className="font-sans"
          />
        </View>

        {/* Professional Summary */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel} className="font-sans">Professional summary*</Text>
            <Text style={styles.charCount} className="font-sans">{user.professionalSummary.length}/250</Text>
          </View>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            value={user.professionalSummary} 
            onChangeText={(txt) => updateField('professionalSummary', txt.slice(0, 250))}
            multiline={true}
            numberOfLines={4}
            className="font-sans"
          />
        </View>

        {/* Skills Management */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <View style={[styles.labelRow, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle} className="font-sans">Skills*</Text>
            <TouchableOpacity 
              onPress={() => setSkillModalVisible(true)}
              style={styles.addButtonInline}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#6671E4" />
              <Text style={styles.addButtonInlineText} className="font-sans">Add Skill</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.skillLabel} className="font-sans">Technical Skills</Text>
          <View style={styles.tagContainer}>
            {user.technicalSkills.map((skill, idx) => (
              <View key={idx} style={styles.editableTag}>
                <Text style={styles.tagText} className="font-sans">{skill}</Text>
                <TouchableOpacity onPress={() => removeSkill(skill, true)} style={styles.removeTag}>
                  <X size={12} color="#8A8D9F" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={[styles.skillLabel, { marginTop: 12 }]} className="font-sans">Soft Skills</Text>
          <View style={styles.tagContainer}>
            {user.softSkills.map((skill, idx) => (
              <View key={idx} style={styles.editableTag}>
                <Text style={styles.tagText} className="font-sans">{skill}</Text>
                <TouchableOpacity onPress={() => removeSkill(skill, false)} style={styles.removeTag}>
                  <X size={12} color="#8A8D9F" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Work Experience */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]} className="font-sans">Work experience*</Text>
          
          {user.workExperience.map((exp, idx) => (
            <View key={idx} style={styles.itemEditorCard}>
              <View style={styles.editorCardHeader}>
                <Text style={styles.editorCardIndex} className="font-sans">Experience #{idx + 1}</Text>
                <TouchableOpacity onPress={() => removeWorkExperience(idx)}>
                  <Trash2 size={16} color="#ED4C5C" />
                </TouchableOpacity>
              </View>

              <TextInput 
                placeholder="Role (e.g. UI/UX Designer)" 
                value={exp.role} 
                onChangeText={(t) => updateWorkExperience(idx, 'role', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
              <TextInput 
                placeholder="Company (e.g. Ogabassey)" 
                value={exp.company} 
                onChangeText={(t) => updateWorkExperience(idx, 'company', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
              <TextInput 
                placeholder="Location (e.g. Accra, Ghana)" 
                value={exp.location} 
                onChangeText={(t) => updateWorkExperience(idx, 'location', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
              <TextInput 
                placeholder="Duration (e.g. 2022 – Present)" 
                value={exp.duration} 
                onChangeText={(t) => updateWorkExperience(idx, 'duration', t)}
                style={styles.inputCompact}
                className="font-sans"
              />

              {/* Bullets */}
              <Text style={styles.bulletsLabel} className="font-sans">Responsibilities / Accomplishments</Text>
              {exp.bullets.map((b, bIdx) => (
                <View key={bIdx} style={styles.bulletRow}>
                  <TextInput 
                    placeholder="Enter responsibility bullet item"
                    value={b}
                    onChangeText={(t) => updateExperienceBullet(idx, bIdx, t)}
                    style={[styles.inputCompact, { flex: 1, marginBottom: 0 }]}
                    className="font-sans"
                  />
                  <TouchableOpacity onPress={() => removeExperienceBullet(idx, bIdx)} style={{ marginLeft: 8 }}>
                    <X size={16} color="#8A8D9F" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity 
                style={styles.addBulletButton} 
                onPress={() => addExperienceBullet(idx)}
                activeOpacity={0.7}
              >
                <Plus size={14} color="#6671E4" />
                <Text style={styles.addBulletText} className="font-sans">Add Bullet Item</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addNewItemButton} 
            onPress={addWorkExperience}
            activeOpacity={0.7}
          >
            <Text style={styles.addNewItemText} className="font-sans">Add work experience +</Text>
          </TouchableOpacity>
        </View>

        {/* Education */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]} className="font-sans">Education</Text>
          
          {user.education.map((edu, idx) => (
            <View key={idx} style={styles.itemEditorCard}>
              <View style={styles.editorCardHeader}>
                <Text style={styles.editorCardIndex} className="font-sans">Education #{idx + 1}</Text>
                <TouchableOpacity onPress={() => removeEducation(idx)}>
                  <Trash2 size={16} color="#ED4C5C" />
                </TouchableOpacity>
              </View>

              <TextInput 
                placeholder="Degree (e.g. B.Sc in Computer Science)" 
                value={edu.degree} 
                onChangeText={(t) => updateEducation(idx, 'degree', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
              <TextInput 
                placeholder="Institution (e.g. University of Ghana)" 
                value={edu.institution} 
                onChangeText={(t) => updateEducation(idx, 'institution', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
              <TextInput 
                placeholder="Duration (e.g. 2022 – 2024)" 
                value={edu.duration} 
                onChangeText={(t) => updateEducation(idx, 'duration', t)}
                style={styles.inputCompact}
                className="font-sans"
              />
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addNewItemButton} 
            onPress={addEducation}
            activeOpacity={0.7}
          >
            <Text style={styles.addNewItemText} className="font-sans">Add education +</Text>
          </TouchableOpacity>
        </View>

        {/* Projects */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]} className="font-sans">Projects</Text>
          
          {user.projects.map((proj, idx) => (
            <View key={idx} style={styles.itemEditorCard}>
              <View style={styles.editorCardHeader}>
                <Text style={styles.editorCardIndex} className="font-sans">Project #{idx + 1}</Text>
                <TouchableOpacity onPress={() => removeProject(idx)}>
                  <Trash2 size={16} color="#ED4C5C" />
                </TouchableOpacity>
              </View>

              <TextInput 
                placeholder="Project Name" 
                value={proj.name} 
                onChangeText={(t) => updateProject(idx, 'name', t)}
                style={styles.inputCompact}
                className="font-sans"
              />

              <Text style={styles.bulletsLabel} className="font-sans">Project Details / Bullets</Text>
              {proj.bullets.map((b, bIdx) => (
                <View key={bIdx} style={styles.bulletRow}>
                  <TextInput 
                    placeholder="Enter project detail bullet"
                    value={b}
                    onChangeText={(t) => updateProjectBullet(idx, bIdx, t)}
                    style={[styles.inputCompact, { flex: 1, marginBottom: 0 }]}
                    className="font-sans"
                  />
                  <TouchableOpacity onPress={() => removeProjectBullet(idx, bIdx)} style={{ marginLeft: 8 }}>
                    <X size={16} color="#8A8D9F" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity 
                style={styles.addBulletButton} 
                onPress={() => addProjectBullet(idx)}
                activeOpacity={0.7}
              >
                <Plus size={14} color="#6671E4" />
                <Text style={styles.addBulletText} className="font-sans">Add Project Detail</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addNewItemButton} 
            onPress={addProject}
            activeOpacity={0.7}
          >
            <Text style={styles.addNewItemText} className="font-sans">Add other project +</Text>
          </TouchableOpacity>
        </View>

        {/* Certifications */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 16 }]} className="font-sans">Certifications</Text>
          
          {user.certifications.map((cert, idx) => (
            <View key={idx} style={[styles.bulletRow, { marginBottom: 10 }]}>
              <TextInput 
                placeholder="Certification Name" 
                value={cert} 
                onChangeText={(t) => updateCertification(idx, t)}
                style={[styles.inputCompact, { flex: 1, marginBottom: 0 }]}
                className="font-sans"
              />
              <TouchableOpacity onPress={() => removeCertification(idx)} style={{ marginLeft: 8 }}>
                <Trash2 size={16} color="#ED4C5C" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity 
            style={styles.addNewItemButton} 
            onPress={addCertification}
            activeOpacity={0.7}
          >
            <Text style={styles.addNewItemText} className="font-sans">Add certificate +</Text>
          </TouchableOpacity>
        </View>

        {/* Tools Management */}
        <View style={styles.sectionDivider} />
        <View style={styles.section}>
          <View style={[styles.labelRow, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle} className="font-sans">Tools*</Text>
            <TouchableOpacity 
              onPress={() => setToolModalVisible(true)}
              style={styles.addButtonInline}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#6671E4" />
              <Text style={styles.addButtonInlineText} className="font-sans">Add Tool</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tagContainer}>
            {user.tools.map((tool, idx) => (
              <View key={idx} style={styles.editableTag}>
                <Text style={styles.tagText} className="font-sans">{tool}</Text>
                <TouchableOpacity onPress={() => removeTool(tool)} style={styles.removeTag}>
                  <X size={12} color="#8A8D9F" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Save Action */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText} className="font-sans">Save</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Add Skill Modal Selection */}
      <Modal
        visible={skillModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSkillModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} className="font-sans">Select a Skill</Text>
              <TouchableOpacity onPress={() => setSkillModalVisible(false)}>
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ALL_AVAILABLE_SKILLS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem} 
                  onPress={() => addSkill(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalItemText} className="font-sans">{item}</Text>
                  {(user.technicalSkills.includes(item) || user.softSkills.includes(item)) && (
                    <Text style={styles.modalItemCheck} className="font-sans">Added</Text>
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300, width: '100%' }}
            />
          </View>
        </View>
      </Modal>

      {/* Add Tool Modal Selection */}
      <Modal
        visible={toolModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setToolModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} className="font-sans">Select a Tool</Text>
              <TouchableOpacity onPress={() => setToolModalVisible(false)}>
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ALL_AVAILABLE_TOOLS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem} 
                  onPress={() => addTool(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalItemText} className="font-sans">{item}</Text>
                  {user.tools.includes(item) && (
                    <Text style={styles.modalItemCheck} className="font-sans">Added</Text>
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300, width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#8A8D9F',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1A1A1A',
  },
  textArea: {
    height: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEE',
    marginVertical: 20,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  addButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6671E4',
  },
  skillLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A8D9F',
    marginTop: 8,
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6F2',
    borderRadius: 9999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  removeTag: {
    marginLeft: 6,
    padding: 2,
  },
  itemEditorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EBEBEE',
  },
  editorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editorCardIndex: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D9F',
  },
  inputCompact: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEE',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1A1A1A',
    marginBottom: 10,
  },
  bulletsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8D9F',
    marginTop: 6,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBulletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addBulletText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6671E4',
  },
  addNewItemButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6671E4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  addNewItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6671E4',
  },
  saveButton: {
    height: 52,
    backgroundColor: '#6671E4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#6671E4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F7F7F9',
    width: '100%',
  },
  modalItemText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  modalItemCheck: {
    fontSize: 12,
    color: '#6671E4',
    fontWeight: '600',
  },
});
